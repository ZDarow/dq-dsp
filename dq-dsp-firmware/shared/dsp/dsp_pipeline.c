/**
 * ESP-32 DSP Processing Pipeline
 *
 * Real-time audio processing using biquad filters.
 * Processes audio frame-by-frame through the full signal chain:
 *   Input Gain/Phase -> PEQ -> Routing -> PEQ -> Crossover -> Gain/Delay/Phase -> Output
 */

#include "dsp_pipeline.h"
#include "dsp_config.h"
#include "esp_dsp.h"
#include "esp_attr.h"
#include <string.h>
#include <math.h>

// Processing state
static biquad_state_t input_eq_state[DSP_NUM_INPUTS][DSP_MAX_PEQ_BANDS];
static biquad_state_t input_room_eq_state[DSP_NUM_INPUTS][DSP_MAX_ROOM_EQ_BANDS];
static biquad_state_t output_eq_state[DSP_NUM_OUTPUTS][DSP_MAX_PEQ_BANDS];
static biquad_state_t output_hp_state[DSP_NUM_OUTPUTS][DSP_MAX_XO_STAGES];
static biquad_state_t output_lp_state[DSP_NUM_OUTPUTS][DSP_MAX_XO_STAGES];

// Delay lines (max 10ms at 96kHz = 960 samples)
static float delay_buffer[DSP_NUM_OUTPUTS][MAX_DELAY_SAMPLES];
static int delay_write_idx[DSP_NUM_OUTPUTS];

/**
 * Process one sample through a biquad filter.
 * Direct Form II Transposed (numerically better for float32).
 *
 * y[n] = b0*x[n] + z1
 * z1   = b1*x[n] + a1*y[n] + z2
 * z2   = b2*x[n] + a2*y[n]
 */
static inline IRAM_ATTR float biquad_process(
    const biquad_coeffs_t* c,
    biquad_state_t* s,
    float x
) {
    float y = c->b0 * x + s->z1;
    s->z1 = c->b1 * x + c->a1 * y + s->z2;
    s->z2 = c->b2 * x + c->a2 * y;
    return y;
}

/**
 * Process a delay line (circular buffer).
 */
static inline IRAM_ATTR float delay_process(
    float* buffer,
    int* write_idx,
    uint32_t delay_samples,
    float input
) {
    if (delay_samples == 0) return input;

    buffer[*write_idx] = input;
    int read_idx = *write_idx - (int)delay_samples;
    if (read_idx < 0) read_idx += MAX_DELAY_SAMPLES;
    *write_idx = (*write_idx + 1) % MAX_DELAY_SAMPLES;

    return buffer[read_idx];
}

/**
 * Initialize all processing state (call once at startup or config change).
 */
void dsp_pipeline_init(void) {
    memset(input_eq_state, 0, sizeof(input_eq_state));
    memset(input_room_eq_state, 0, sizeof(input_room_eq_state));
    memset(output_eq_state, 0, sizeof(output_eq_state));
    memset(output_hp_state, 0, sizeof(output_hp_state));
    memset(output_lp_state, 0, sizeof(output_lp_state));
    memset(delay_buffer, 0, sizeof(delay_buffer));
    memset(delay_write_idx, 0, sizeof(delay_write_idx));
}

/**
 * Process one frame of audio (one sample per channel).
 *
 * @param cfg      Pointer to the DSP configuration
 * @param in_l     Input left sample (float, -1.0 to 1.0)
 * @param in_r     Input right sample
 * @param out      Output array [4] for the 4 DAC outputs
 */
IRAM_ATTR void dsp_pipeline_process(
    const dsp_config_t* cfg,
    float in_l,
    float in_r,
    float out[DSP_NUM_OUTPUTS]
) {
    float input_samples[DSP_NUM_INPUTS] = { in_l, in_r };
    float processed_inputs[DSP_NUM_INPUTS];

    // === Stage 1: Input Processing ===
    for (int i = 0; i < DSP_NUM_INPUTS; i++) {
        const dsp_input_t* inp = &cfg->inputs[i];
        float sample = input_samples[i];

        // Gain
        sample *= inp->gain;

        // Phase invert
        if (inp->phase_invert) sample = -sample;

        // Mute
        if (inp->mute) sample = 0.0f;

        // Room EQ (check per-band enabled flag — bands aren't contiguous)
        for (int b = 0; b < DSP_MAX_ROOM_EQ_BANDS; b++) {
            if (inp->room_eq_params[b].enabled)
                sample = biquad_process(&inp->room_eq_bands[b], &input_room_eq_state[i][b], sample);
        }

        // PEQ (check per-band enabled flag — bands aren't contiguous)
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            if (inp->eq_params[b].enabled)
                sample = biquad_process(&inp->eq_bands[b], &input_eq_state[i][b], sample);
        }

        processed_inputs[i] = sample;
    }

    // === Stage 2: Routing Matrix ===
    float routed[DSP_NUM_OUTPUTS];
    for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
        routed[o] = 0.0f;
        for (int i = 0; i < DSP_NUM_INPUTS; i++) {
            const dsp_crosspoint_t* cp = &cfg->routing[i][o];
            if (cp->enabled) {
                routed[o] += processed_inputs[i] * cp->gain;
            }
        }
    }

    // === Stage 3: Output Processing ===
    for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
        const dsp_output_t* outp = &cfg->outputs[o];
        float sample = routed[o];

        // PEQ (check per-band enabled flag)
        for (int b = 0; b < DSP_MAX_PEQ_BANDS; b++) {
            if (outp->eq_params[b].enabled)
                sample = biquad_process(&outp->eq_bands[b], &output_eq_state[o][b], sample);
        }

        // Crossover HP (only active stages)
        for (int s = 0; s < outp->num_hp_stages; s++) {
            sample = biquad_process(&outp->hp_stages[s], &output_hp_state[o][s], sample);
        }

        // Crossover LP (only active stages)
        for (int s = 0; s < outp->num_lp_stages; s++) {
            sample = biquad_process(&outp->lp_stages[s], &output_lp_state[o][s], sample);
        }

        // Output gain
        sample *= outp->gain;

        // Delay
        sample = delay_process(
            delay_buffer[o],
            &delay_write_idx[o],
            outp->delay_samples,
            sample
        );

        // Phase invert
        if (outp->phase_invert) sample = -sample;

        // Mute
        if (outp->mute) sample = 0.0f;

        // Master volume
        sample *= cfg->global.master_volume;

        out[o] = sample;
    }
}

#define DSP_PIPELINE_BLOCK_SIZE 32

static void IRAM_ATTR process_biquad_block_enabled(
    const biquad_coeffs_t* coefs,
    const eq_band_params_t* params,
    biquad_state_t* states,
    float* data,
    int len,
    int num_bands
) {
    for (int b = 0; b < num_bands; b++) {
        if (!params[b].enabled) continue;
        float coef[5] = {coefs[b].b0, coefs[b].b1, coefs[b].b2, -coefs[b].a1, -coefs[b].a2};
        float* w = (float*)&states[b];
        dsps_biquad_f32_ae32(data, data, len, coef, w);
    }
}

void dsp_pipeline_process_block(
    const dsp_config_t* cfg,
    const float in_l[],
    const float in_r[],
    float out[][DSP_NUM_OUTPUTS],
    int len
) {
    static float processed_inputs[DSP_NUM_INPUTS][DSP_PIPELINE_BLOCK_SIZE];
    static float routed[DSP_NUM_OUTPUTS][DSP_PIPELINE_BLOCK_SIZE];

    for (int offset = 0; offset < len; offset += DSP_PIPELINE_BLOCK_SIZE) {
        int block_len = len - offset;
        if (block_len > DSP_PIPELINE_BLOCK_SIZE) block_len = DSP_PIPELINE_BLOCK_SIZE;

        for (int i = 0; i < DSP_NUM_INPUTS; i++) {
            const dsp_input_t* inp = &cfg->inputs[i];
            const float* in = (i == 0) ? in_l + offset : in_r + offset;
            float* buf = processed_inputs[i];

            for (int s = 0; s < block_len; s++) {
                float sample = in[s];
                sample *= inp->gain;
                if (inp->phase_invert) sample = -sample;
                if (inp->mute) sample = 0.0f;
                buf[s] = sample;
            }

            process_biquad_block_enabled(
                inp->room_eq_bands, inp->room_eq_params,
                &input_room_eq_state[i][0], buf, block_len, DSP_MAX_ROOM_EQ_BANDS
            );
            process_biquad_block_enabled(
                inp->eq_bands, inp->eq_params,
                &input_eq_state[i][0], buf, block_len, DSP_MAX_PEQ_BANDS
            );
        }

        for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
            float* rout_out = routed[o];
            for (int s = 0; s < block_len; s++) {
                float mixed = 0.0f;
                for (int i = 0; i < DSP_NUM_INPUTS; i++) {
                    const dsp_crosspoint_t* cp = &cfg->routing[i][o];
                    if (cp->enabled) {
                        mixed += processed_inputs[i][s] * cp->gain;
                    }
                }
                rout_out[s] = mixed;
            }
        }

        for (int o = 0; o < DSP_NUM_OUTPUTS; o++) {
            const dsp_output_t* outp = &cfg->outputs[o];
            float* data = routed[o];
            float* out_data = &out[offset][o];

            process_biquad_block_enabled(
                outp->eq_bands, outp->eq_params,
                &output_eq_state[o][0], data, block_len, DSP_MAX_PEQ_BANDS
            );

            for (int s = 0; s < outp->num_hp_stages; s++) {
                float coef[5] = {outp->hp_stages[s].b0, outp->hp_stages[s].b1,
                                 outp->hp_stages[s].b2, -outp->hp_stages[s].a1, -outp->hp_stages[s].a2};
                float* w = (float*)&output_hp_state[o][s];
                dsps_biquad_f32_ae32(data, data, block_len, coef, w);
            }

            for (int s = 0; s < outp->num_lp_stages; s++) {
                float coef[5] = {outp->lp_stages[s].b0, outp->lp_stages[s].b1,
                                 outp->lp_stages[s].b2, -outp->lp_stages[s].a1, -outp->lp_stages[s].a2};
                float* w = (float*)&output_lp_state[o][s];
                dsps_biquad_f32_ae32(data, data, block_len, coef, w);
            }

            for (int s = 0; s < block_len; s++) {
                float sample = data[s];
                sample *= outp->gain;
                sample = delay_process(
                    delay_buffer[o], &delay_write_idx[o],
                    outp->delay_samples, sample
                );
                if (outp->phase_invert) sample = -sample;
                if (outp->mute) sample = 0.0f;
                sample *= cfg->global.master_volume;
                out_data[s] = sample;
            }
        }
    }
}
