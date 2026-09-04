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

                if (outp->delay_samples != 0) {
                    delay_buffer[o][delay_write_idx[o]] = sample;
                    int read_idx = delay_write_idx[o] - (int)outp->delay_samples;
                    if (read_idx < 0) read_idx += MAX_DELAY_SAMPLES;
                    delay_write_idx[o] = (delay_write_idx[o] + 1) % MAX_DELAY_SAMPLES;
                    sample = delay_buffer[o][read_idx];
                }

                if (outp->phase_invert) sample = -sample;
                if (outp->mute) sample = 0.0f;
                sample *= cfg->global.master_volume;
                out_data[s] = sample;
            }
        }
    }
}
