/**
 * Thread-Safe Live DSP Parameter Update Engine
 *
 * Double-buffered dsp_config_t with atomic pointer swap for lock-free
 * audio task reads. Biquad coefficient recalculation runs in BLE task
 * context using the Audio EQ Cookbook formulas (ported from biquad.ts).
 */

#include "dsp_param_update.h"
#include "ble_protocol.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include <math.h>
#include <string.h>
#include <stdatomic.h>

static const char *TAG = "dsp_param";

/* -----------------------------------------------------------------------
 * Double Buffer
 * ----------------------------------------------------------------------- */

static dsp_config_t config_buf_a __attribute__((aligned(4)));
static dsp_config_t config_buf_b __attribute__((aligned(4)));

/* Atomic pointer to the currently active config (read by audio task). */
static _Atomic(const dsp_config_t *) active_ptr = NULL;

/* Pointer to the staging config (written only by BLE task). */
static dsp_config_t *staging_ptr = NULL;

/* FreeRTOS queue for update notifications (BLE task -> audio task). */
static QueueHandle_t update_queue = NULL;

/* Flag: staging has uncommitted changes. */
static volatile bool pending_update = false;

/* Flag: Core 0 is recalculating coefficients — audio task should output silence. */
static volatile bool s_recalc_busy = false;

/* Shadow EQ/XO params are now stored directly in dsp_config_t
 * (eq_band_params_t and xo_params_t in dsp_config.h).
 * No separate static arrays needed. */

/* -----------------------------------------------------------------------
 * Biquad Coefficient Calculator (ported from src/dsp/biquad.ts)
 *
 * Audio EQ Cookbook by Robert Bristow-Johnson.
 * Returns coefficients in negated-a convention (additions only in inner loop).
 * ----------------------------------------------------------------------- */

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static void calc_biquad(uint8_t type, float freq, float sample_rate,
                        float gain_db, float q, biquad_coeffs_t *out)
{
    float w0 = (2.0f * (float)M_PI * freq) / sample_rate;
    float cos_w0 = cosf(w0);
    float sin_w0 = sinf(w0);
    float alpha = sin_w0 / (2.0f * q);
    float A = powf(10.0f, gain_db / 40.0f);  /* sqrt of linear gain */

    float b0, b1, b2, a0, a1, a2;

    switch (type) {
    case BLE_FILTER_PEAKING:
        b0 = 1.0f + alpha * A;
        b1 = -2.0f * cos_w0;
        b2 = 1.0f - alpha * A;
        a0 = 1.0f + alpha / A;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha / A;
        break;

    case BLE_FILTER_LOW_SHELF: {
        float sqrtA = sqrtf(A);
        float two_sqrtA_alpha = 2.0f * sqrtA * alpha;
        b0 = A * ((A + 1.0f) - (A - 1.0f) * cos_w0 + two_sqrtA_alpha);
        b1 = 2.0f * A * ((A - 1.0f) - (A + 1.0f) * cos_w0);
        b2 = A * ((A + 1.0f) - (A - 1.0f) * cos_w0 - two_sqrtA_alpha);
        a0 = (A + 1.0f) + (A - 1.0f) * cos_w0 + two_sqrtA_alpha;
        a1 = -2.0f * ((A - 1.0f) + (A + 1.0f) * cos_w0);
        a2 = (A + 1.0f) + (A - 1.0f) * cos_w0 - two_sqrtA_alpha;
        break;
    }

    case BLE_FILTER_HIGH_SHELF: {
        float sqrtA = sqrtf(A);
        float two_sqrtA_alpha = 2.0f * sqrtA * alpha;
        b0 = A * ((A + 1.0f) + (A - 1.0f) * cos_w0 + two_sqrtA_alpha);
        b1 = -2.0f * A * ((A - 1.0f) + (A + 1.0f) * cos_w0);
        b2 = A * ((A + 1.0f) + (A - 1.0f) * cos_w0 - two_sqrtA_alpha);
        a0 = (A + 1.0f) - (A - 1.0f) * cos_w0 + two_sqrtA_alpha;
        a1 = 2.0f * ((A - 1.0f) - (A + 1.0f) * cos_w0);
        a2 = (A + 1.0f) - (A - 1.0f) * cos_w0 - two_sqrtA_alpha;
        break;
    }

    case BLE_FILTER_LOW_PASS:
        b0 = (1.0f - cos_w0) / 2.0f;
        b1 = 1.0f - cos_w0;
        b2 = (1.0f - cos_w0) / 2.0f;
        a0 = 1.0f + alpha;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha;
        break;

    case BLE_FILTER_HIGH_PASS:
        b0 = (1.0f + cos_w0) / 2.0f;
        b1 = -(1.0f + cos_w0);
        b2 = (1.0f + cos_w0) / 2.0f;
        a0 = 1.0f + alpha;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha;
        break;

    case BLE_FILTER_BAND_PASS:
        b0 = alpha;
        b1 = 0.0f;
        b2 = -alpha;
        a0 = 1.0f + alpha;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha;
        break;

    case BLE_FILTER_NOTCH:
        b0 = 1.0f;
        b1 = -2.0f * cos_w0;
        b2 = 1.0f;
        a0 = 1.0f + alpha;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha;
        break;

    case BLE_FILTER_ALL_PASS:
        b0 = 1.0f - alpha;
        b1 = -2.0f * cos_w0;
        b2 = 1.0f + alpha;
        a0 = 1.0f + alpha;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha;
        break;

    default:
        /* Identity (pass-through) */
        out->b0 = 1.0f; out->b1 = 0.0f; out->b2 = 0.0f;
        out->a1 = 0.0f; out->a2 = 0.0f;
        return;
    }

    /* Normalize and negate a coefficients */
    out->b0 =  b0 / a0;
    out->b1 =  b1 / a0;
    out->b2 =  b2 / a0;
    out->a1 = -a1 / a0;  /* negated for addition-only inner loop */
    out->a2 = -a2 / a0;
}

/** Set identity (pass-through) biquad coefficients. */
static inline void biquad_identity(biquad_coeffs_t *c)
{
    c->b0 = 1.0f; c->b1 = 0.0f; c->b2 = 0.0f;
    c->a1 = 0.0f; c->a2 = 0.0f;
}

/* -----------------------------------------------------------------------
 * Crossover Coefficient Calculator (ported from src/dsp/crossover.ts)
 * ----------------------------------------------------------------------- */

/**
 * Butterworth Q for the i-th stage of an n-th order filter.
 * Q = 1 / (2 * cos(pi * (2*k + 1) / (2*n)))
 */
static float butterworth_q(int order, int stage_index)
{
    float angle = ((float)M_PI * (2.0f * stage_index + 1.0f)) / (2.0f * order);
    return 1.0f / (2.0f * cosf(angle));
}

/**
 * Calculate crossover biquad stages and write into a coefficients array.
 * Returns the number of active stages written.
 *
 * @param is_hp        true for high-pass, false for low-pass
 * @param xo_type      BLE_XO_BUTTERWORTH or BLE_XO_LINKWITZ_RILEY
 * @param slope_stages Number of biquad stages (1, 2, or 4)
 * @param freq         Crossover frequency in Hz
 * @param sample_rate  Sample rate in Hz
 * @param stages_out   Array of at least DSP_MAX_XO_STAGES biquad_coeffs_t
 */
static int calc_crossover_stages(bool is_hp, uint8_t xo_type, uint8_t slope_stages,
                                 float freq, float sample_rate,
                                 biquad_coeffs_t stages_out[DSP_MAX_XO_STAGES])
{
    uint8_t filter_type = is_hp ? BLE_FILTER_HIGH_PASS : BLE_FILTER_LOW_PASS;
    int num_stages = 0;

    /* Set all stages to identity first */
    for (int i = 0; i < DSP_MAX_XO_STAGES; i++) {
        biquad_identity(&stages_out[i]);
    }

    if (xo_type == BLE_XO_BUTTERWORTH) {
        int order = slope_stages * 2;  /* stages=1->2nd order, 2->4th, 4->8th */
        num_stages = slope_stages;
        for (int i = 0; i < num_stages && i < DSP_MAX_XO_STAGES; i++) {
            float q = butterworth_q(order, i);
            calc_biquad(filter_type, freq, sample_rate, 0.0f, q, &stages_out[i]);
        }
    } else {
        /* Linkwitz-Riley: squared Butterworth */
        if (slope_stages == 1) {
            /* LR12: single stage with Q=0.5 */
            num_stages = 1;
            calc_biquad(filter_type, freq, sample_rate, 0.0f, 0.5f, &stages_out[0]);
        } else {
            /* LR24 (slope_stages=2): two BW2 stages (each Q=0.707) */
            /* LR48 (slope_stages=4): four BW4 stages */
            int bw_order = slope_stages;       /* half the LR order in stages */
            int bw_stages = bw_order / 2;      /* BW stages per half */
            if (bw_stages < 1) bw_stages = 1;
            num_stages = slope_stages;
            /* First half: BW stages */
            for (int i = 0; i < bw_stages && i < DSP_MAX_XO_STAGES; i++) {
                float q = butterworth_q(bw_order, i);
                calc_biquad(filter_type, freq, sample_rate, 0.0f, q, &stages_out[i]);
            }
            /* Second half: duplicate (LR = BW squared) */
            for (int i = 0; i < bw_stages && (i + bw_stages) < DSP_MAX_XO_STAGES; i++) {
                stages_out[i + bw_stages] = stages_out[i];
            }
        }
    }

    return num_stages;
}

/* -----------------------------------------------------------------------
 * Recalculation helpers
 * ----------------------------------------------------------------------- */

static float get_sample_rate(void)
{
    return (float)staging_ptr->global.sample_rate;
}

/** Recalculate a single EQ band for an input channel in the staging config. */
static void recalc_input_eq_band(int ch, int band)
{
    const eq_band_params_t *p = &staging_ptr->inputs[ch].eq_params[band];
    biquad_coeffs_t *c = &staging_ptr->inputs[ch].eq_bands[band];

    if (!p->enabled || p->frequency <= 0.0f || p->q <= 0.0f) {
        biquad_identity(c);
        return;
    }
    s_recalc_busy = true;
    calc_biquad(p->filter_type, p->frequency, get_sample_rate(),
                p->gain_db, p->q, c);
    s_recalc_busy = false;
}

/** Recalculate a single Room EQ band for an input channel in the staging config. */
static void recalc_input_room_eq_band(int ch, int band)
{
    const eq_band_params_t *p = &staging_ptr->inputs[ch].room_eq_params[band];
    biquad_coeffs_t *c = &staging_ptr->inputs[ch].room_eq_bands[band];

    if (!p->enabled || p->frequency <= 0.0f || p->q <= 0.0f) {
        biquad_identity(c);
        ESP_LOGI(TAG, "RoomEQ ch=%d band=%d -> IDENTITY (en=%d freq=%.1f q=%.2f)",
                 ch, band, p->enabled, p->frequency, p->q);
        return;
    }
    s_recalc_busy = true;
    calc_biquad(p->filter_type, p->frequency, get_sample_rate(),
                p->gain_db, p->q, c);
    s_recalc_busy = false;
    ESP_LOGI(TAG, "RoomEQ ch=%d band=%d -> recalc (type=%d freq=%.1f gain=%.1fdB q=%.2f) b0=%.4f",
             ch, band, p->filter_type, p->frequency, p->gain_db, p->q, c->b0);
}

/** Recalculate a single EQ band for an output channel in the staging config. */
static void recalc_output_eq_band(int ch, int band)
{
    const eq_band_params_t *p = &staging_ptr->outputs[ch].eq_params[band];
    biquad_coeffs_t *c = &staging_ptr->outputs[ch].eq_bands[band];

    if (!p->enabled || p->frequency <= 0.0f || p->q <= 0.0f) {
        biquad_identity(c);
        return;
    }
    s_recalc_busy = true;
    calc_biquad(p->filter_type, p->frequency, get_sample_rate(),
                p->gain_db, p->q, c);
    s_recalc_busy = false;
}

/** Recalculate HP crossover stages for an output channel. */
static void recalc_output_hp(int ch)
{
    const xo_params_t *p = &staging_ptr->outputs[ch].hp_params;
    dsp_output_t *outp = &staging_ptr->outputs[ch];

    if (!p->enabled || p->frequency <= 0.0f) {
        outp->num_hp_stages = 0;
        for (int i = 0; i < DSP_MAX_XO_STAGES; i++)
            biquad_identity(&outp->hp_stages[i]);
        return;
    }
    s_recalc_busy = true;
    int n = calc_crossover_stages(true, p->filter_type, p->slope,
                                  p->frequency, get_sample_rate(),
                                  outp->hp_stages);
    outp->num_hp_stages = (uint8_t)n;
    s_recalc_busy = false;
}

/** Recalculate LP crossover stages for an output channel. */
static void recalc_output_lp(int ch)
{
    const xo_params_t *p = &staging_ptr->outputs[ch].lp_params;
    dsp_output_t *outp = &staging_ptr->outputs[ch];

    if (!p->enabled || p->frequency <= 0.0f) {
        outp->num_lp_stages = 0;
        for (int i = 0; i < DSP_MAX_XO_STAGES; i++)
            biquad_identity(&outp->lp_stages[i]);
        return;
    }
    s_recalc_busy = true;
    int n = calc_crossover_stages(false, p->filter_type, p->slope,
                                  p->frequency, get_sample_rate(),
                                  outp->lp_stages);
    outp->num_lp_stages = (uint8_t)n;
    s_recalc_busy = false;
}

/* -----------------------------------------------------------------------
 * Value extraction helpers
 * ----------------------------------------------------------------------- */

static float read_f32(const uint8_t *p)
{
    float v;
    memcpy(&v, p, sizeof(float));  /* handles unaligned + LE on ESP-32 */
    return v;
}

static uint8_t read_u8(const uint8_t *p)
{
    return *p;
}

/* -----------------------------------------------------------------------
 * Public API
 * ----------------------------------------------------------------------- */

esp_err_t dsp_param_init(const dsp_config_t *initial)
{
    memcpy(&config_buf_a, initial, sizeof(dsp_config_t));
    memcpy(&config_buf_b, initial, sizeof(dsp_config_t));

    atomic_store(&active_ptr, &config_buf_a);
    staging_ptr = &config_buf_b;
    pending_update = false;

    /* Initialize shadow EQ params to defaults (if not already set by NVS load) */
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            eq_band_params_t *p = &staging_ptr->inputs[i].eq_params[b];
            if (p->frequency <= 0.0f) {
                p->frequency = 1000.0f;
                p->q = 0.707f;
                p->filter_type = BLE_FILTER_PEAKING;
            }
        }
    }
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        for (int b = 0; b < DSP_MAX_ROOM_EQ_BANDS; b++) {
            eq_band_params_t *rp = &staging_ptr->inputs[i].room_eq_params[b];
            if (rp->frequency <= 0.0f) {
                rp->frequency = 1000.0f;
                rp->q = 0.707f;
                rp->filter_type = BLE_FILTER_PEAKING;
            }
        }
    }
    for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            eq_band_params_t *p = &staging_ptr->outputs[o].eq_params[b];
            if (p->frequency <= 0.0f) {
                p->frequency = 1000.0f;
                p->q = 0.707f;
                p->filter_type = BLE_FILTER_PEAKING;
            }
        }
        if (staging_ptr->outputs[o].hp_params.slope == 0) {
            staging_ptr->outputs[o].hp_params.slope = BLE_XO_SLOPE_12;
            staging_ptr->outputs[o].hp_params.filter_type = BLE_XO_BUTTERWORTH;
        }
        if (staging_ptr->outputs[o].lp_params.slope == 0) {
            staging_ptr->outputs[o].lp_params.slope = BLE_XO_SLOPE_12;
            staging_ptr->outputs[o].lp_params.filter_type = BLE_XO_BUTTERWORTH;
        }
    }
    /* Sync active buffer with staging (shadow params included) */
    memcpy(&config_buf_a, &config_buf_b, sizeof(dsp_config_t));

    /* Create the update notification queue (depth 1, binary semaphore style) */
    update_queue = xQueueCreate(1, sizeof(uint8_t));
    if (update_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create update queue");
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGI(TAG, "Parameter update engine initialized (sample rate: %lu Hz)",
             (unsigned long)initial->global.sample_rate);
    return ESP_OK;
}

const dsp_config_t *dsp_param_get_active(void)
{
    return atomic_load(&active_ptr);
}

bool dsp_param_has_pending(void)
{
    return pending_update;
}

void dsp_param_commit(void)
{
    /* Swap pointers: staging becomes active, old active becomes staging. */
    dsp_config_t *old_active = (dsp_config_t *)atomic_load(&active_ptr);

    /* Copy staging to old_active so both buffers are in sync after swap.
     * This ensures the new staging buffer (old active) has the latest data
     * for subsequent incremental updates. */
    memcpy(old_active, staging_ptr, sizeof(dsp_config_t));

    /* Atomic pointer swap with memory barrier */
    atomic_store(&active_ptr, staging_ptr);
    staging_ptr = old_active;
    pending_update = false;

    /* Diagnostic: print which Room EQ bands are active in the new config so
     * we can confirm coefficients made it from staging to the audio task. */
    const dsp_config_t *act = (const dsp_config_t *)atomic_load(&active_ptr);
    int active_count = 0;
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        for (int b = 0; b < DSP_MAX_ROOM_EQ_BANDS; b++) {
            if (act->inputs[i].room_eq_params[b].enabled) active_count++;
        }
    }
    ESP_LOGI(TAG, "Commit: active RoomEQ bands enabled = %d", active_count);
}

void dsp_param_notify_update(void)
{
    uint8_t dummy = 1;
    /* Overwrite mode: if queue is full, old notification is still there. */
    xQueueOverwrite(update_queue, &dummy);
    pending_update = true;
}

bool dsp_param_poll_update(void)
{
    uint8_t dummy;
    return (xQueueReceive(update_queue, &dummy, 0) == pdTRUE);
}

bool dsp_param_is_recalculating(void)
{
    return s_recalc_busy;
}

void dsp_param_set_sample_rate(uint32_t sample_rate)
{
    uint32_t old_sr = staging_ptr->global.sample_rate;
    if (sample_rate == old_sr) {
        ESP_LOGI(TAG, "Sample rate unchanged (%lu Hz), skipping recalc",
                 (unsigned long)sample_rate);
        return;
    }

    staging_ptr->global.sample_rate = sample_rate;
    staging_ptr->header.sample_rate = sample_rate;

    ESP_LOGI(TAG, "Sample rate updated to %lu Hz (was %lu), recalculating filters",
             (unsigned long)sample_rate, (unsigned long)old_sr);

    /* Recalculate all active input EQ bands */
    for (int ch = 0; ch < DSP_NUM_INPUTS; ch++) {
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            if (staging_ptr->inputs[ch].eq_params[b].enabled) {
                recalc_input_eq_band(ch, b);
            }
        }
        for (int b = 0; b < DSP_MAX_ROOM_EQ_BANDS; b++) {
            if (staging_ptr->inputs[ch].room_eq_params[b].enabled) {
                recalc_input_room_eq_band(ch, b);
            }
        }
    }

    /* Recalculate all active output EQ bands and crossovers */
    for (int ch = 0; ch < DSP_NUM_OUTPUTS; ch++) {
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            if (staging_ptr->outputs[ch].eq_params[b].enabled) {
                recalc_output_eq_band(ch, b);
            }
        }
        if (staging_ptr->outputs[ch].hp_params.enabled) {
            recalc_output_hp(ch);
        }
        if (staging_ptr->outputs[ch].lp_params.enabled) {
            recalc_output_lp(ch);
        }
    }

    dsp_param_commit();
    dsp_param_notify_update();
}

uint8_t dsp_param_apply(const uint8_t *msg, uint16_t len)
{
    /* Validate message length (before setting busy flag — no recalc needed for invalid msgs) */
    if (!ble_validate_param_msg_len(msg, len)) {
        ESP_LOGW(TAG, "Invalid param message length: %d", len);
        return BLE_STATUS_INVALID_PARAM;
    }

    const ble_param_msg_header_t *hdr = (const ble_param_msg_header_t *)msg;
    const uint8_t *value_ptr = msg + BLE_PARAM_MSG_HEADER_SIZE;
    uint8_t val_size = ble_param_value_size(hdr->param_type);

    /* Read the value */
    float f32_val = 0.0f;
    uint8_t u8_val = 0;
    if (val_size == 4) {
        f32_val = read_f32(value_ptr);
    } else {
        u8_val = read_u8(value_ptr);
    }

    uint8_t block   = hdr->target_block;
    uint8_t channel = hdr->channel;
    uint8_t param   = hdr->param_type;
    uint8_t index   = hdr->param_index;

    /* Dispatch based on target block */
    switch (block) {

    /* === Input Channel === */
    case BLE_BLOCK_INPUT: {
        if (channel >= DSP_NUM_INPUTS) return BLE_STATUS_OUT_OF_RANGE;
        dsp_input_t *inp = &staging_ptr->inputs[channel];

        switch (param) {
        case BLE_PARAM_GAIN:
            inp->gain = f32_val;
            break;
        case BLE_PARAM_MUTE:
            inp->mute = u8_val;
            break;
        case BLE_PARAM_PHASE:
            inp->phase_invert = u8_val;
            break;
        case BLE_PARAM_EQ_BAND_ENABLE:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].enabled = u8_val;
            recalc_input_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_FREQ:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].frequency = f32_val;
            recalc_input_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_GAIN:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].gain_db = f32_val;
            recalc_input_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_Q:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].q = f32_val;
            recalc_input_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_TYPE:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].filter_type = u8_val;
            recalc_input_eq_band(channel, index);
            break;

        /* Room EQ */
        case BLE_PARAM_ROOM_EQ_BAND_ENABLE:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].enabled = u8_val;
            recalc_input_room_eq_band(channel, index);
            break;
        case BLE_PARAM_ROOM_EQ_BAND_FREQ:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].frequency = f32_val;
            recalc_input_room_eq_band(channel, index);
            break;
        case BLE_PARAM_ROOM_EQ_BAND_GAIN:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].gain_db = f32_val;
            recalc_input_room_eq_band(channel, index);
            break;
        case BLE_PARAM_ROOM_EQ_BAND_Q:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].q = f32_val;
            recalc_input_room_eq_band(channel, index);
            break;
        case BLE_PARAM_ROOM_EQ_BAND_TYPE:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].filter_type = u8_val;
            recalc_input_room_eq_band(channel, index);
            break;

        default:
            return BLE_STATUS_INVALID_PARAM;
        }
        break;
    }

    /* === Output Channel === */
    case BLE_BLOCK_OUTPUT: {
        if (channel >= DSP_NUM_OUTPUTS) return BLE_STATUS_OUT_OF_RANGE;
        dsp_output_t *outp = &staging_ptr->outputs[channel];

        switch (param) {
        case BLE_PARAM_GAIN:
            outp->gain = f32_val;
            break;
        case BLE_PARAM_MUTE:
            outp->mute = u8_val;
            break;
        case BLE_PARAM_PHASE:
            outp->phase_invert = u8_val;
            break;
        case BLE_PARAM_DELAY: {
            uint32_t samples = (uint32_t)f32_val;
            if (samples > MAX_DELAY_SAMPLES) {
                ESP_LOGW(TAG, "Delay out of range: %lu (max %d)", (unsigned long)samples, MAX_DELAY_SAMPLES);
                return BLE_STATUS_OUT_OF_RANGE;
            }
            outp->delay_samples = samples;
            ESP_LOGI(TAG, "Output[%d] delay = %lu samples (%.2f ms @ %lu Hz)",
                     channel, (unsigned long)samples,
                     (float)samples * 1000.0f / (float)staging_ptr->global.sample_rate,
                     (unsigned long)staging_ptr->global.sample_rate);
            break;
        }

        /* Output EQ */
        case BLE_PARAM_EQ_BAND_ENABLE:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].enabled = u8_val;
            recalc_output_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_FREQ:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].frequency = f32_val;
            recalc_output_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_GAIN:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].gain_db = f32_val;
            recalc_output_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_Q:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].q = f32_val;
            recalc_output_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_TYPE:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].filter_type = u8_val;
            recalc_output_eq_band(channel, index);
            break;

        /* Crossover HP */
        case BLE_PARAM_CROSSOVER_HP_ENABLE:
            staging_ptr->outputs[channel].hp_params.enabled = u8_val;
            recalc_output_hp(channel);
            break;
        case BLE_PARAM_CROSSOVER_HP_FREQ:
            staging_ptr->outputs[channel].hp_params.frequency = f32_val;
            recalc_output_hp(channel);
            break;
        case BLE_PARAM_CROSSOVER_HP_TYPE:
            staging_ptr->outputs[channel].hp_params.filter_type = u8_val;
            recalc_output_hp(channel);
            break;
        case BLE_PARAM_CROSSOVER_HP_SLOPE:
            staging_ptr->outputs[channel].hp_params.slope = u8_val;
            recalc_output_hp(channel);
            break;

        /* Crossover LP */
        case BLE_PARAM_CROSSOVER_LP_ENABLE:
            staging_ptr->outputs[channel].lp_params.enabled = u8_val;
            recalc_output_lp(channel);
            break;
        case BLE_PARAM_CROSSOVER_LP_FREQ:
            staging_ptr->outputs[channel].lp_params.frequency = f32_val;
            recalc_output_lp(channel);
            break;
        case BLE_PARAM_CROSSOVER_LP_TYPE:
            staging_ptr->outputs[channel].lp_params.filter_type = u8_val;
            recalc_output_lp(channel);
            break;
        case BLE_PARAM_CROSSOVER_LP_SLOPE:
            staging_ptr->outputs[channel].lp_params.slope = u8_val;
            recalc_output_lp(channel);
            break;

        default:
            return BLE_STATUS_INVALID_PARAM;
        }
        break;
    }

    /* === Routing Matrix === */
    case BLE_BLOCK_ROUTING: {
        /* channel = input index, param_index = output index */
        uint8_t in_idx  = channel;
        uint8_t out_idx = index;
        if (in_idx >= DSP_NUM_INPUTS || out_idx >= DSP_NUM_OUTPUTS)
            return BLE_STATUS_OUT_OF_RANGE;

        dsp_crosspoint_t *cp = &staging_ptr->routing[in_idx][out_idx];
        switch (param) {
        case BLE_PARAM_ROUTING_ENABLE:
            cp->enabled = u8_val;
            break;
        case BLE_PARAM_ROUTING_GAIN:
            cp->gain = f32_val;
            break;
        default:
            return BLE_STATUS_INVALID_PARAM;
        }
        break;
    }

    /* === Global === */
    case BLE_BLOCK_GLOBAL: {
        switch (param) {
        case BLE_PARAM_MASTER_VOLUME:
            staging_ptr->global.master_volume = f32_val;
            break;
        default:
            return BLE_STATUS_INVALID_PARAM;
        }
        break;
    }

    /* === System (drift compensation tuning) === */
    case BLE_BLOCK_SYSTEM: {
        switch (param) {
        case BLE_PARAM_SYSTEM_DRIFT_KP:
            staging_ptr->system.drift_kp = f32_val;
            break;
        case BLE_PARAM_SYSTEM_DRIFT_KI:
            staging_ptr->system.drift_ki = f32_val;
            break;
        case BLE_PARAM_SYSTEM_DRIFT_TARGET:
            staging_ptr->system.drift_target_fill = f32_val;
            break;
        case BLE_PARAM_SYSTEM_DRIFT_MAX_PPM:
            staging_ptr->system.drift_max_ppm = f32_val;
            break;
        default:
            return BLE_STATUS_INVALID_PARAM;
        }
        break;
    }

    default:
        return BLE_STATUS_INVALID_PARAM;
    }

    ESP_LOGD(TAG, "Applied param: block=%d ch=%d param=0x%02x idx=%d",
             block, channel, param, index);
    return BLE_STATUS_OK;
}

uint8_t dsp_param_apply_bulk(const uint8_t *data, size_t len)
{
    if (len != sizeof(dsp_config_t)) {
        ESP_LOGW(TAG, "Bulk config size mismatch: %d vs expected %d",
                 (int)len, (int)sizeof(dsp_config_t));
        return BLE_STATUS_INVALID_PARAM;
    }

    const dsp_config_t *incoming = (const dsp_config_t *)data;

    /* Validate magic */
    if (incoming->header.magic != DSP_MAGIC) {
        ESP_LOGW(TAG, "Bulk config invalid magic: 0x%08lx",
                 (unsigned long)incoming->header.magic);
        return BLE_STATUS_INVALID_PARAM;
    }

    /* Copy to staging */
    memcpy(staging_ptr, data, sizeof(dsp_config_t));

    /* Commit immediately for bulk updates */
    dsp_param_commit();
    dsp_param_notify_update();

    ESP_LOGI(TAG, "Bulk config applied (preset %d, sr %lu Hz)",
             incoming->header.preset_index,
             (unsigned long)incoming->header.sample_rate);
    return BLE_STATUS_OK;
}
