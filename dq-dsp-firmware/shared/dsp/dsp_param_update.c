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
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include <math.h>
#include <string.h>
#include <stddef.h>
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

    /* Reject non-valid slope values (defence-in-depth). Valid values are
     * BLE_XO_SLOPE_12 (1), BLE_XO_SLOPE_24 (2) and BLE_XO_SLOPE_48 (4).
     * Without this, a corrupted/injected value would make num_stages exceed
     * DSP_MAX_XO_STAGES and drive out-of-bounds reads/writes in the audio task. */
    if (slope_stages != BLE_XO_SLOPE_12 && slope_stages != BLE_XO_SLOPE_24 &&
        slope_stages != BLE_XO_SLOPE_48) {
        slope_stages = BLE_XO_SLOPE_12;
    }

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

    /* num_stages is bounded to {1,2,4} by the slope guard above, all
     * <= DSP_MAX_XO_STAGES. */
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
    calc_biquad(p->filter_type, p->frequency, get_sample_rate(),
                p->gain_db, p->q, c);
}

/** Recalculate a single Room EQ band for an input channel in the staging config. */
static void recalc_input_room_eq_band(int ch, int band)
{
    const eq_band_params_t *p = &staging_ptr->inputs[ch].room_eq_params[band];
    biquad_coeffs_t *c = &staging_ptr->inputs[ch].room_eq_bands[band];

    if (!p->enabled || p->frequency <= 0.0f || p->q <= 0.0f) {
        biquad_identity(c);
        ESP_LOGV(TAG, "RoomEQ ch=%d band=%d -> IDENTITY (en=%d freq=%.1f q=%.2f)",
                 ch, band, p->enabled, p->frequency, p->q);
        return;
    }
    calc_biquad(p->filter_type, p->frequency, get_sample_rate(),
                p->gain_db, p->q, c);
    ESP_LOGV(TAG, "RoomEQ ch=%d band=%d -> recalc (type=%d freq=%.1f gain=%.1fdB q=%.2f) b0=%.4f",
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
    calc_biquad(p->filter_type, p->frequency, get_sample_rate(),
                p->gain_db, p->q, c);
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
    int n = calc_crossover_stages(true, p->filter_type, p->slope,
                                  p->frequency, get_sample_rate(),
                                  outp->hp_stages);
    outp->num_hp_stages = (uint8_t)n;
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
    int n = calc_crossover_stages(false, p->filter_type, p->slope,
                                  p->frequency, get_sample_rate(),
                                  outp->lp_stages);
    outp->num_lp_stages = (uint8_t)n;
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
 * Value validation helpers
 *
 * All floats entering the config from the wire must be finite and within
 * sane physical ranges. NaN/Inf bypass "<=" guards in recalc helpers and
 * would produce NaN biquad coefficients (garbage/DC on the audio output),
 * so every f32 write point is guarded with isfinite() + range checks.
 * ----------------------------------------------------------------------- */

static bool is_valid_freq(float v)
{
    return isfinite(v) && v >= 10.0f && v <= 20000.0f;
}

static bool is_valid_eq_gain_db(float v)
{
    return isfinite(v) && v >= -30.0f && v <= 30.0f;
}

static bool is_valid_q(float v)
{
    return isfinite(v) && v >= 0.01f && v <= 40.0f;
}

static bool is_valid_linear_gain(float v, float max)
{
    return isfinite(v) && v >= 0.0f && v <= max;
}

static bool is_valid_filter_type(uint8_t v)
{
    return v <= BLE_FILTER_ALL_PASS;
}

static bool is_valid_xo_type(uint8_t v)
{
    return v == BLE_XO_BUTTERWORTH || v == BLE_XO_LINKWITZ_RILEY;
}

static bool is_valid_xo_slope(uint8_t v)
{
    return v == BLE_XO_SLOPE_12 || v == BLE_XO_SLOPE_24 || v == BLE_XO_SLOPE_48;
}

static bool is_valid_drift(float v, float min, float max)
{
    return isfinite(v) && v >= min && v <= max;
}

/* -----------------------------------------------------------------------
 * CRC32 (IEEE 802.3, reflected, poly 0xEDB88320, init/final XOR 0xFFFFFFFF)
 * Matches src/export/checksum.ts in the web UI.
 * ----------------------------------------------------------------------- */

static uint32_t crc32_ieee(const uint8_t *data, size_t len, uint32_t crc)
{
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            crc = (crc & 1u) ? (crc >> 1) ^ 0xedb88320u : (crc >> 1);
        }
    }
    return crc;
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

void dsp_param_refresh_crc_in_place(dsp_config_t *cfg)
{
    if (!cfg) return;

    /* CRC32 over the whole blob with the crc field treated as zero,
     * matching the web UI's checksum.ts / binary-encoder.ts. Operates on a
     * caller-provided buffer (a snapshot), never on the active config that
     * the audio task reads lock-free. */
    const uint8_t *bytes = (const uint8_t *)cfg;
    const size_t crc_off = offsetof(dsp_config_t, header.crc32);
    static const uint8_t zero_field[4] = { 0, 0, 0, 0 };

    uint32_t crc = 0xffffffffu;
    crc = crc32_ieee(bytes, crc_off, crc);
    crc = crc32_ieee(zero_field, 4, crc);
    crc = crc32_ieee(bytes + crc_off + 4, sizeof(dsp_config_t) - crc_off - 4, crc);
    cfg->header.crc32 = crc ^ 0xffffffffu;
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

    /* Commit happens on every param change (including slider drags), so keep
     * per-commit diagnostics out of the hot path: LOGV only. */
    const dsp_config_t *act = (const dsp_config_t *)atomic_load(&active_ptr);
    int active_count = 0;
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        for (int b = 0; b < DSP_MAX_ROOM_EQ_BANDS; b++) {
            if (act->inputs[i].room_eq_params[b].enabled) active_count++;
        }
    }
    ESP_LOGV(TAG, "Commit: active RoomEQ bands enabled = %d", active_count);
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
            if (!is_valid_linear_gain(f32_val, 10.0f))
                return BLE_STATUS_OUT_OF_RANGE;
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
            if (!is_valid_freq(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].frequency = f32_val;
            recalc_input_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_GAIN:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_eq_gain_db(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].gain_db = f32_val;
            recalc_input_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_Q:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_q(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].eq_params[index].q = f32_val;
            recalc_input_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_TYPE:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_filter_type(u8_val)) return BLE_STATUS_OUT_OF_RANGE;
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
            if (!is_valid_freq(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].frequency = f32_val;
            recalc_input_room_eq_band(channel, index);
            break;
        case BLE_PARAM_ROOM_EQ_BAND_GAIN:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_eq_gain_db(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].gain_db = f32_val;
            recalc_input_room_eq_band(channel, index);
            break;
        case BLE_PARAM_ROOM_EQ_BAND_Q:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_q(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->inputs[channel].room_eq_params[index].q = f32_val;
            recalc_input_room_eq_band(channel, index);
            break;
        case BLE_PARAM_ROOM_EQ_BAND_TYPE:
            if (index >= DSP_MAX_ROOM_EQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_filter_type(u8_val)) return BLE_STATUS_OUT_OF_RANGE;
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
            if (!is_valid_linear_gain(f32_val, 10.0f))
                return BLE_STATUS_OUT_OF_RANGE;
            outp->gain = f32_val;
            break;
        case BLE_PARAM_MUTE:
            outp->mute = u8_val;
            break;
        case BLE_PARAM_PHASE:
            outp->phase_invert = u8_val;
            break;
        case BLE_PARAM_DELAY: {
            /* Reject NaN/Inf and clamp-to-range BEFORE the float->uint32 cast:
             * casting a float outside [0, UINT32_MAX] is undefined behaviour. */
            if (!isfinite(f32_val) || f32_val < 0.0f || f32_val > (float)MAX_DELAY_SAMPLES) {
                ESP_LOGW(TAG, "Delay out of range: %f (max %d)", (double)f32_val, MAX_DELAY_SAMPLES);
                return BLE_STATUS_OUT_OF_RANGE;
            }
            uint32_t samples = (uint32_t)f32_val;
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
            if (!is_valid_freq(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].frequency = f32_val;
            recalc_output_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_GAIN:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_eq_gain_db(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].gain_db = f32_val;
            recalc_output_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_Q:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_q(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].q = f32_val;
            recalc_output_eq_band(channel, index);
            break;
        case BLE_PARAM_EQ_BAND_TYPE:
            if (index >= DSP_MAX_PEQ_BANDS) return BLE_STATUS_OUT_OF_RANGE;
            if (!is_valid_filter_type(u8_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].eq_params[index].filter_type = u8_val;
            recalc_output_eq_band(channel, index);
            break;

        /* Crossover HP */
        case BLE_PARAM_CROSSOVER_HP_ENABLE:
            staging_ptr->outputs[channel].hp_params.enabled = u8_val;
            recalc_output_hp(channel);
            break;
        case BLE_PARAM_CROSSOVER_HP_FREQ:
            if (!is_valid_freq(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].hp_params.frequency = f32_val;
            recalc_output_hp(channel);
            break;
        case BLE_PARAM_CROSSOVER_HP_TYPE:
            if (!is_valid_xo_type(u8_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].hp_params.filter_type = u8_val;
            recalc_output_hp(channel);
            break;
        case BLE_PARAM_CROSSOVER_HP_SLOPE:
            if (!is_valid_xo_slope(u8_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].hp_params.slope = u8_val;
            recalc_output_hp(channel);
            break;

        /* Crossover LP */
        case BLE_PARAM_CROSSOVER_LP_ENABLE:
            staging_ptr->outputs[channel].lp_params.enabled = u8_val;
            recalc_output_lp(channel);
            break;
        case BLE_PARAM_CROSSOVER_LP_FREQ:
            if (!is_valid_freq(f32_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].lp_params.frequency = f32_val;
            recalc_output_lp(channel);
            break;
        case BLE_PARAM_CROSSOVER_LP_TYPE:
            if (!is_valid_xo_type(u8_val)) return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->outputs[channel].lp_params.filter_type = u8_val;
            recalc_output_lp(channel);
            break;
        case BLE_PARAM_CROSSOVER_LP_SLOPE:
            if (!is_valid_xo_slope(u8_val)) return BLE_STATUS_OUT_OF_RANGE;
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
            if (!is_valid_linear_gain(f32_val, 1.0f))
                return BLE_STATUS_OUT_OF_RANGE;
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
            /* UI allows -72..+12 dB -> dbToLinear(12) ~= 3.98 */
            if (!is_valid_linear_gain(f32_val, 10.0f))
                return BLE_STATUS_OUT_OF_RANGE;
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
            if (!is_valid_drift(f32_val, 0.0f, 100.0f))
                return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->system.drift_kp = f32_val;
            break;
        case BLE_PARAM_SYSTEM_DRIFT_KI:
            if (!is_valid_drift(f32_val, 0.0f, 100.0f))
                return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->system.drift_ki = f32_val;
            break;
        case BLE_PARAM_SYSTEM_DRIFT_TARGET:
            if (!is_valid_drift(f32_val, 0.0f, 1.0f))
                return BLE_STATUS_OUT_OF_RANGE;
            staging_ptr->system.drift_target_fill = f32_val;
            break;
        case BLE_PARAM_SYSTEM_DRIFT_MAX_PPM:
            if (!is_valid_drift(f32_val, 0.0f, 100000.0f))
                return BLE_STATUS_OUT_OF_RANGE;
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

/* Returns true if every float in [p, p+n) is finite. */
static bool all_finite(const float *p, size_t n)
{
    for (size_t i = 0; i < n; i++) {
        if (!isfinite(p[i])) {
            return false;
        }
    }
    return true;
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

    /* Validate version: layout must match this build (prevents silent
     * mis-decoding when host and firmware protocol versions diverge). */
    if (incoming->header.version != DSP_VERSION) {
        ESP_LOGW(TAG, "Bulk config version mismatch: %u vs expected %u",
                 (unsigned)incoming->header.version, (unsigned)DSP_VERSION);
        return BLE_STATUS_INVALID_PARAM;
    }

    /* Validate CRC32 over the whole blob with the crc field treated as zero
     * (same scheme as the web UI's binary-encoder). */
    {
        uint32_t crc = 0xffffffffu;
        static const uint8_t zero_crc_field[4] = { 0, 0, 0, 0 };
        crc = crc32_ieee(data, offsetof(dsp_config_t, header.crc32), crc);
        crc = crc32_ieee(zero_crc_field, 4, crc);
        crc = crc32_ieee(data + offsetof(dsp_config_t, header.crc32) + 4,
                         sizeof(dsp_config_t) - offsetof(dsp_config_t, header.crc32) - 4, crc);
        crc ^= 0xffffffffu;
        if (incoming->header.crc32 != crc) {
            ESP_LOGW(TAG, "Bulk config CRC mismatch: got 0x%08lx, expected 0x%08lx",
                     (unsigned long)incoming->header.crc32, (unsigned long)crc);
            return BLE_STATUS_CRC_ERROR;
        }
    }

    /* Defence-in-depth: never let a malicious/corrupted blob drive the audio
     * task out of bounds via num_hp_stages / num_lp_stages / delay_samples. */
    for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
        if (incoming->outputs[o].num_hp_stages > DSP_MAX_XO_STAGES ||
            incoming->outputs[o].num_lp_stages > DSP_MAX_XO_STAGES) {
            ESP_LOGW(TAG, "Bulk config has invalid crossover stage count");
            return BLE_STATUS_INVALID_PARAM;
        }
        if (incoming->outputs[o].delay_samples > MAX_DELAY_SAMPLES) {
            ESP_LOGW(TAG, "Bulk config has invalid delay: %lu (max %d)",
                     (unsigned long)incoming->outputs[o].delay_samples, MAX_DELAY_SAMPLES);
            return BLE_STATUS_OUT_OF_RANGE;
        }
    }

    /* NaN/Inf guard: the CRC scheme is documented and reproducible, but a
     * checksummed blob can still carry NaN/Inf floats (host bug, or a preset
     * edited with a tool that never sanitises). A NaN biquad coefficient or
     * gain poisons the filter state permanently and only recovers on reboot,
     * so reject the whole blob up front. */
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        const dsp_input_t *inp = &incoming->inputs[i];
        if (!isfinite(inp->gain)) {
            ESP_LOGW(TAG, "Bulk config has non-finite input gain");
            return BLE_STATUS_INVALID_PARAM;
        }
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            if (!all_finite(&inp->eq_bands[b].b0, 5)) {
                ESP_LOGW(TAG, "Bulk config has non-finite input EQ coefficient");
                return BLE_STATUS_INVALID_PARAM;
            }
        }
        for (int b = 0; b < DSP_MAX_ROOM_EQ_BANDS; b++) {
            if (!all_finite(&inp->room_eq_bands[b].b0, 5)) {
                ESP_LOGW(TAG, "Bulk config has non-finite RoomEQ coefficient");
                return BLE_STATUS_INVALID_PARAM;
            }
        }
    }
    for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
        const dsp_output_t *outp = &incoming->outputs[o];
        if (!isfinite(outp->gain)) {
            ESP_LOGW(TAG, "Bulk config has non-finite output gain");
            return BLE_STATUS_INVALID_PARAM;
        }
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            if (!all_finite(&outp->eq_bands[b].b0, 5)) {
                ESP_LOGW(TAG, "Bulk config has non-finite output EQ coefficient");
                return BLE_STATUS_INVALID_PARAM;
            }
        }
        for (int s = 0; s < DSP_MAX_XO_STAGES; s++) {
            if (!all_finite(&outp->hp_stages[s].b0, 5) ||
                !all_finite(&outp->lp_stages[s].b0, 5)) {
                ESP_LOGW(TAG, "Bulk config has non-finite crossover coefficient");
                return BLE_STATUS_INVALID_PARAM;
            }
        }
    }
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
            if (!isfinite(incoming->routing[i][o].gain)) {
                ESP_LOGW(TAG, "Bulk config has non-finite routing gain");
                return BLE_STATUS_INVALID_PARAM;
            }
        }
    }
    if (!isfinite(incoming->global.master_volume)) {
        ESP_LOGW(TAG, "Bulk config has non-finite master volume");
        return BLE_STATUS_INVALID_PARAM;
    }
    if (!all_finite(&incoming->system.drift_kp, 4)) {
        ESP_LOGW(TAG, "Bulk config has non-finite drift coefficients");
        return BLE_STATUS_INVALID_PARAM;
    }
    /* Range checks mirroring the per-param apply path (dsp_param_apply). */
    if (!is_valid_linear_gain(incoming->global.master_volume, 10.0f)) {
        ESP_LOGW(TAG, "Bulk config master volume out of range: %f",
                 (double)incoming->global.master_volume);
        return BLE_STATUS_OUT_OF_RANGE;
    }
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        if (!is_valid_linear_gain(incoming->inputs[i].gain, 10.0f)) {
            ESP_LOGW(TAG, "Bulk config input gain out of range");
            return BLE_STATUS_OUT_OF_RANGE;
        }
    }
    for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
        if (!is_valid_linear_gain(incoming->outputs[o].gain, 10.0f)) {
            ESP_LOGW(TAG, "Bulk config output gain out of range");
            return BLE_STATUS_OUT_OF_RANGE;
        }
    }
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
            if (!is_valid_linear_gain(incoming->routing[i][o].gain, 1.0f)) {
                ESP_LOGW(TAG, "Bulk config routing gain out of range");
                return BLE_STATUS_OUT_OF_RANGE;
            }
        }
    }

    /* Copy to staging */
    memcpy(staging_ptr, data, sizeof(dsp_config_t));

    /* Sample rate is fixed at compile time by CONFIG_UAC_SAMPLE_RATE — the USB
     * UAC descriptor advertises only that rate, and biquad coefficients are
     * frequency-warped by the design Fs. If the UI sends a config carrying a
     * different rate (e.g. UI default 48k vs firmware 96k), the coefficients
     * inside that blob were computed for the wrong Fs and would warp the EQ
     * cutoffs and possibly destabilise filter poles.
     *
     * Defence: force header/global sample_rate to the firmware-fixed rate, and
     * wipe all biquad coefficients to identity (transparent passthrough). The
     * UI will re-derive correct coefficients on its next push once it observes
     * the corrected sample rate from the device. */
    if (staging_ptr->global.sample_rate != CONFIG_UAC_SAMPLE_RATE) {
        ESP_LOGW(TAG, "Bulk config sr=%lu mismatches firmware %d — forcing rate, wiping biquads to identity",
                 (unsigned long)staging_ptr->global.sample_rate, CONFIG_UAC_SAMPLE_RATE);
        staging_ptr->header.sample_rate = CONFIG_UAC_SAMPLE_RATE;
        staging_ptr->global.sample_rate = CONFIG_UAC_SAMPLE_RATE;
        const biquad_coeffs_t identity = {1.0f, 0.0f, 0.0f, 0.0f, 0.0f};
        for (int i = 0; i < DSP_NUM_INPUTS; i++) {
            for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++)
                staging_ptr->inputs[i].eq_bands[b] = identity;
        }
        for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
            for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++)
                staging_ptr->outputs[o].eq_bands[b] = identity;
            for (int s = 0; s < DSP_MAX_XO_STAGES; s++) {
                staging_ptr->outputs[o].hp_stages[s] = identity;
                staging_ptr->outputs[o].lp_stages[s] = identity;
            }
        }
    }

    /* Hand off to the audio task: it owns dsp_param_commit() (single writer,
     * polled between audio chunks). Committing from here too would race the
     * audio task's commit — a double swap where the second commit re-applies
     * a stale staging buffer after the first already went active. */
    dsp_param_notify_update();

    ESP_LOGI(TAG, "Bulk config applied (preset %d, sr %lu Hz)",
             incoming->header.preset_index,
             (unsigned long)staging_ptr->header.sample_rate);
    return BLE_STATUS_OK;
}
