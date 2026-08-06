/**
 * Golden test G1: firmware biquad_process vs esp-dsp dsps_biquad_f32_ansi.
 *
 * Host test — compiles and runs on Linux with plain gcc (no ESP-IDF).
 *
 * The firmware stores biquad coefficients in NEGATED-a convention
 * (see calc_biquad in dsp_param_update.c: "additions only in inner loop"),
 * i.e. a1/a2 already carry the sign from the transfer function denominator.
 * esp-dsp uses the standard convention (coef = {b0,b1,b2,a1,a2} with positive
 * a1/a2 in the denominator). To compare, we negate a1/a2 before passing them
 * to the esp-dsp reference.
 *
 * This pins the C biquad to the Espressif reference so future optimizations
 * (block processing) can't silently diverge.
 *
 * NOTE on tolerance: both implementations are float32. For high-Q / high-gain
 * filters (e.g. low-shelf with a1 ~ 1.97) the Direct Form II Transposed state
 * accumulates rounding that grows to ~1e-5..1e-4 over 1024 samples even when
 * both are compared against a double-precision reference. So the pass threshold
 * is 1e-4 (well above the ~5e-5 float32 accumulation noise, far below any real
 * algorithmic divergence which shows up as err ~ 1e0+ or inf).
 *
 * Build & run:
 *   gcc -O2 -o /tmp/biquad_golden tests/golden_biquad.c -lm && /tmp/biquad_golden
 */

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <stdint.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/* ---- Filter type constants (mirror of dsp_config.h) ---- */
#define BLE_FILTER_PEAKING    0
#define BLE_FILTER_LOW_SHELF  1
#define BLE_FILTER_HIGH_SHELF 2
#define BLE_FILTER_LOW_PASS   3
#define BLE_FILTER_HIGH_PASS  4
#define BLE_FILTER_BAND_PASS  5
#define BLE_FILTER_NOTCH      6
#define BLE_FILTER_ALL_PASS   7

/* ---- Firmware types (mirror of dsp_config.h) ---- */
typedef struct {
    float b0, b1, b2;
    float a1; /* = -a1/a0 from transfer function (negated-a convention) */
    float a2;
} biquad_coeffs_t;

typedef struct {
    float z1;
    float z2;
} biquad_state_t;

/* ---- Firmware biquad (Direct Form II Transposed, negated-a) ---- */
static inline float biquad_process(const biquad_coeffs_t* c, biquad_state_t* s, float x) {
    float y = c->b0 * x + s->z1;
    s->z1 = c->b1 * x + c->a1 * y + s->z2;
    s->z2 = c->b2 * x + c->a2 * y;
    return y;
}

/* ---- Firmware coefficient calculator (mirror of dsp_param_update.c) ---- */
static void calc_biquad(uint8_t type, float freq, float sample_rate,
                        float gain_db, float q, biquad_coeffs_t *out)
{
    float w0 = (2.0f * (float)M_PI * freq) / sample_rate;
    float cos_w0 = cosf(w0);
    float sin_w0 = sinf(w0);
    float alpha = sin_w0 / (2.0f * q);
    float A = powf(10.0f, gain_db / 40.0f);
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
        float t = 2.0f * sqrtA * alpha;
        b0 = A * ((A + 1.0f) - (A - 1.0f) * cos_w0 + t);
        b1 = 2.0f * A * ((A - 1.0f) - (A + 1.0f) * cos_w0);
        b2 = A * ((A + 1.0f) - (A - 1.0f) * cos_w0 - t);
        a0 = (A + 1.0f) + (A - 1.0f) * cos_w0 + t;
        a1 = -2.0f * ((A - 1.0f) + (A + 1.0f) * cos_w0);
        a2 = (A + 1.0f) + (A - 1.0f) * cos_w0 - t;
        break;
    }
    case BLE_FILTER_HIGH_SHELF: {
        float sqrtA = sqrtf(A);
        float t = 2.0f * sqrtA * alpha;
        b0 = A * ((A + 1.0f) + (A - 1.0f) * cos_w0 + t);
        b1 = -2.0f * A * ((A - 1.0f) + (A + 1.0f) * cos_w0);
        b2 = A * ((A + 1.0f) + (A - 1.0f) * cos_w0 - t);
        a0 = (A + 1.0f) - (A - 1.0f) * cos_w0 + t;
        a1 = 2.0f * ((A - 1.0f) - (A + 1.0f) * cos_w0);
        a2 = (A + 1.0f) - (A - 1.0f) * cos_w0 - t;
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
        b0 = 1.0f; b1 = 0.0f; b2 = 0.0f;
        a0 = 1.0f; a1 = 0.0f; a2 = 0.0f;
        break;
    }

    /* normalize by a0, NEGATE a (addition-only inner loop, see dsp_param_update.c) */
    out->b0 = b0 / a0;
    out->b1 = b1 / a0;
    out->b2 = b2 / a0;
    out->a1 = -a1 / a0;
    out->a2 = -a2 / a0;
}

/* ---- esp-dsp ANSI biquad (reference). coef = {b0,b1,b2,a1,a2} standard ---- */
static void dsps_biquad_f32_ansi_ref(const float* input, float* output, int len,
                                     const float* coef, float* w) {
    for (int i = 0; i < len; i++) {
        float d0 = input[i] - coef[3] * w[0] - coef[4] * w[1];
        output[i] = coef[0] * d0 + coef[1] * w[0] + coef[2] * w[1];
        w[1] = w[0];
        w[0] = d0;
    }
}

/* ---- Deterministic PRNG (xorshift32) ---- */
static uint32_t s_rng = 0x12345678u;
static uint32_t next_rng(void) {
    uint32_t x = s_rng;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    s_rng = x;
    return x;
}

static int check_case(uint8_t type, float freq, float gain_db, float q,
                      float sample_rate, int n, const char* name) {
    biquad_coeffs_t c;
    calc_biquad(type, freq, sample_rate, gain_db, q, &c);

    /* esp-dsp expects standard convention: negate a1/a2 */
    float coef[5] = { c.b0, c.b1, c.b2, -c.a1, -c.a2 };

    biquad_state_t st = { 0.0f, 0.0f };
    float w[2] = { 0.0f, 0.0f };

    float in[1024], ref[1024];
    for (int i = 0; i < n; i++) {
        in[i] = ((float)next_rng() / (float)0xFFFFFFFFu) * 2.0f - 1.0f;
    }

    dsps_biquad_f32_ansi_ref(in, ref, n, coef, w);

    int bad = 0;
    float max_err = 0.0f;
    for (int i = 0; i < n; i++) {
        float y = biquad_process(&c, &st, in[i]);
        float err = fabsf(y - ref[i]);
        if (err > max_err) max_err = err;
        if (err > 1e-4f) bad++;   /* float32 tolerance; see note below */
    }

    if (bad == 0) {
        printf("PASS  %-24s max_err=%.3e\n", name, max_err);
        return 0;
    }
    printf("FAIL  %-24s bad=%d/%d max_err=%.3e\n", name, bad, n, max_err);
    return 1;
}

int main(void) {
    int fails = 0;
    const float fs = 48000.0f;

    struct { uint8_t type; float freq; float q; float gain; const char* name; } cases[] = {
        { BLE_FILTER_LOW_PASS,   1000.0f, 0.707f, 0.0f, "lowpass 1k" },
        { BLE_FILTER_LOW_PASS,   200.0f,  0.707f, 0.0f, "lowpass 200" },
        { BLE_FILTER_HIGH_PASS,  1000.0f, 0.707f, 0.0f, "highpass 1k" },
        { BLE_FILTER_PEAKING,    1000.0f, 1.0f,   6.0f, "peaking +6dB" },
        { BLE_FILTER_PEAKING,    4000.0f, 0.5f,  -9.0f, "peaking -9dB" },
        { BLE_FILTER_LOW_SHELF,  200.0f,  0.707f, 3.0f, "low-shelf +3dB" },
        { BLE_FILTER_HIGH_SHELF, 8000.0f, 0.707f, -4.0f, "high-shelf -4dB" },
        { BLE_FILTER_BAND_PASS,  1000.0f, 1.0f,   0.0f, "bandpass 1k" },
        { BLE_FILTER_NOTCH,      1000.0f, 1.0f,   0.0f, "notch 1k" },
        { BLE_FILTER_ALL_PASS,   1000.0f, 0.707f, 0.0f, "allpass 1k" },
    };
    int ncases = (int)(sizeof(cases) / sizeof(cases[0]));

    for (int i = 0; i < ncases; i++) {
        s_rng = 0x12345678u + (uint32_t)i;
        fails += check_case(cases[i].type, cases[i].freq, cases[i].gain,
                            cases[i].q, fs, 1024, cases[i].name);
    }

    printf("\n%s (%d/%d cases)\n", fails ? "FAILED" : "ALL PASSED",
           ncases - fails, ncases);
    return fails ? 1 : 0;
}