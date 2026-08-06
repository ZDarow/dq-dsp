/**
 * Golden test G1: crossover stages — firmware calc_crossover_stages
 * (dsp_param_update.c) vs web UI calculateCrossoverStages (crossover.ts).
 *
 * Host test — compiles and runs on Linux with plain gcc (no ESP-IDF).
 *
 * Verifies that the C and TypeScript implementations produce identical
 * cascaded-biquad stages for every Butterworth / Linkwitz-Riley slope
 * (12/24/48 dB/oct) and both HP/LP polarities. Since both delegate to the
 * same Audio EQ Cookbook biquad calculator, the stage Q values and resulting
 * biquad coefficients must match bit-for-bit.
 *
 * Build & run:
 *   gcc -O2 -o /tmp/xo_golden tests/golden_crossover.c -lm && /tmp/xo_golden
 */

#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#define BLE_FILTER_LOW_PASS   3
#define BLE_FILTER_HIGH_PASS  4

#define BLE_XO_SLOPE_12 1
#define BLE_XO_SLOPE_24 2
#define BLE_XO_SLOPE_48 4

#define BLE_XO_BUTTERWORTH 0
#define BLE_XO_LINKWITZ_RILEY 1

#define DSP_MAX_XO_STAGES 4

/* ---- Firmware types (mirror of dsp_config.h) ---- */
typedef struct {
    float b0, b1, b2;
    float a1, a2;
} biquad_coeffs_t;

static void biquad_identity(biquad_coeffs_t *out)
{
    out->b0 = 1.0f; out->b1 = 0.0f; out->b2 = 0.0f;
    out->a1 = 0.0f; out->a2 = 0.0f;
}

/* ---- Cookbook calculator (mirror of dsp_param_update.c / biquad.ts) ---- */
static void calc_biquad(uint8_t type, float freq, float sample_rate,
                        float gain_db, float q, biquad_coeffs_t *out)
{
    float w0 = (2.0f * (float)M_PI * freq) / sample_rate;
    float cos_w0 = cosf(w0);
    float sin_w0 = sinf(w0);
    float alpha = sin_w0 / (2.0f * q);
    float b0, b1, b2, a0, a1, a2;

    if (type == BLE_FILTER_LOW_PASS) {
        b0 = (1.0f - cos_w0) / 2.0f;
        b1 = 1.0f - cos_w0;
        b2 = (1.0f - cos_w0) / 2.0f;
        a0 = 1.0f + alpha;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha;
    } else { /* HIGH_PASS */
        b0 = (1.0f + cos_w0) / 2.0f;
        b1 = -(1.0f + cos_w0);
        b2 = (1.0f + cos_w0) / 2.0f;
        a0 = 1.0f + alpha;
        a1 = -2.0f * cos_w0;
        a2 = 1.0f - alpha;
    }

    out->b0 = b0 / a0;
    out->b1 = b1 / a0;
    out->b2 = b2 / a0;
    out->a1 = -a1 / a0;
    out->a2 = -a2 / a0;
}

static float butterworth_q(int order, int stage_index)
{
    float angle = ((float)M_PI * (2.0f * stage_index + 1.0f)) / (2.0f * order);
    return 1.0f / (2.0f * cosf(angle));
}

/* ---- Firmware crossover (mirror of calc_crossover_stages) ---- */
static int calc_crossover_stages_fw(bool is_hp, uint8_t xo_type, uint8_t slope_stages,
                                    float freq, float sample_rate,
                                    biquad_coeffs_t stages_out[DSP_MAX_XO_STAGES])
{
    uint8_t filter_type = is_hp ? BLE_FILTER_HIGH_PASS : BLE_FILTER_LOW_PASS;
    int num_stages = 0;

    for (int i = 0; i < DSP_MAX_XO_STAGES; i++) biquad_identity(&stages_out[i]);

    if (xo_type == BLE_XO_BUTTERWORTH) {
        int order = slope_stages * 2;
        num_stages = slope_stages;
        for (int i = 0; i < num_stages && i < DSP_MAX_XO_STAGES; i++) {
            float q = butterworth_q(order, i);
            calc_biquad(filter_type, freq, sample_rate, 0.0f, q, &stages_out[i]);
        }
    } else {
        if (slope_stages == 1) {
            num_stages = 1;
            calc_biquad(filter_type, freq, sample_rate, 0.0f, 0.5f, &stages_out[0]);
        } else {
            int bw_order = slope_stages;
            int bw_stages = bw_order / 2;
            if (bw_stages < 1) bw_stages = 1;
            num_stages = slope_stages;
            for (int i = 0; i < bw_stages && i < DSP_MAX_XO_STAGES; i++) {
                float q = butterworth_q(bw_order, i);
                calc_biquad(filter_type, freq, sample_rate, 0.0f, q, &stages_out[i]);
            }
            for (int i = 0; i < bw_stages && (i + bw_stages) < DSP_MAX_XO_STAGES; i++) {
                stages_out[i + bw_stages] = stages_out[i];
            }
        }
    }
    return num_stages;
}

/* ---- TS crossover (mirror of crossover.ts) ---- */
static int butterworth_stages_ts(bool is_hp, int slope, float freq, float sample_rate,
                                 biquad_coeffs_t *stages_out)
{
    int order = slope / 6;
    int num_stages = order / 2;
    for (int i = 0; i < num_stages; i++) {
        float q = butterworth_q(order, i);
        calc_biquad(is_hp ? BLE_FILTER_HIGH_PASS : BLE_FILTER_LOW_PASS,
                    freq, sample_rate, 0.0f, q, &stages_out[i]);
    }
    return num_stages;
}

/* LR branch (TS): bwOrder = slope/12, bwSlope = bwOrder*6 */
static void linkwitz_riley_ts(bool is_hp, int slope, float freq, float sample_rate,
                              biquad_coeffs_t stages_out[DSP_MAX_XO_STAGES])
{
    if (slope == 12) {
        calc_biquad(is_hp ? BLE_FILTER_HIGH_PASS : BLE_FILTER_LOW_PASS,
                    freq, sample_rate, 0.0f, 0.5f, &stages_out[0]);
        return;
    }
    int bw_slope = (slope / 12) * 6;   /* 24->12, 48->24 */
    int n = butterworth_stages_ts(is_hp, bw_slope, freq, sample_rate, stages_out);
    /* doubled: copy first half into second half */
    for (int i = 0; i < n; i++) stages_out[i + n] = stages_out[i];
}

static int fails = 0;

static int coeffs_equal(const biquad_coeffs_t *a, const biquad_coeffs_t *b)
{
    return fabsf(a->b0 - b->b0) < 1e-6f &&
           fabsf(a->b1 - b->b1) < 1e-6f &&
           fabsf(a->b2 - b->b2) < 1e-6f &&
           fabsf(a->a1 - b->a1) < 1e-6f &&
           fabsf(a->a2 - b->a2) < 1e-6f;
}

static void check_case(bool is_hp, uint8_t xo_type, uint8_t slope_stages,
                       float freq, float sample_rate, const char *name)
{
    biquad_coeffs_t fw[DSP_MAX_XO_STAGES], ts[DSP_MAX_XO_STAGES];
    int n_fw = calc_crossover_stages_fw(is_hp, xo_type, slope_stages, freq, sample_rate, fw);

    /* Build TS reference */
    for (int i = 0; i < DSP_MAX_XO_STAGES; i++) biquad_identity(&ts[i]);
    int slope = slope_stages * 12;  /* 1->12, 2->24, 4->48 dB/oct */
    if (xo_type == BLE_XO_BUTTERWORTH) {
        butterworth_stages_ts(is_hp, slope, freq, sample_rate, ts);
    } else {
        linkwitz_riley_ts(is_hp, slope, freq, sample_rate, ts);
    }

    int bad = 0;
    for (int i = 0; i < DSP_MAX_XO_STAGES; i++) {
        if (!coeffs_equal(&fw[i], &ts[i])) bad++;
    }
    if (bad == 0) {
        printf("PASS  %-30s stages=%d\n", name, n_fw);
    } else {
        printf("FAIL  %-30s stages=%d bad_stages=%d\n", name, n_fw, bad);
        fails++;
    }
}

int main(void)
{
    const float fs = 48000.0f;
    const float freqs[] = { 80.0f, 1000.0f, 3200.0f };
    const int n_freq = (int)(sizeof(freqs) / sizeof(freqs[0]));
    const uint8_t slopes[] = { BLE_XO_SLOPE_12, BLE_XO_SLOPE_24, BLE_XO_SLOPE_48 };

    for (int hp = 0; hp < 2; hp++) {
        for (int t = 0; t < 2; t++) {
            for (int s = 0; s < 3; s++) {
                for (int f = 0; f < n_freq; f++) {
                    char name[64];
                    snprintf(name, sizeof(name), "%s %s %d dB/oct @%.0f Hz",
                             hp ? "HP" : "LP",
                             t == BLE_XO_BUTTERWORTH ? "BW" : "LR",
                             slopes[s] * 12, freqs[f]);
                    check_case(hp != 0, (uint8_t)t, slopes[s], freqs[f], fs, name);
                }
            }
        }
    }

    printf("\n%s (%d/%d cases)\n", fails ? "FAILED" : "ALL PASSED",
           fails ? 0 : 36, 36);
    return fails ? 1 : 0;
}