/**
 * USB Audio Class (UAC) Device Driver for ESP32-S3
 *
 * Uses the espressif/usb_device_uac component to present the board
 * as a USB speaker to the host.  Audio data flows:
 *
 *   Host (Mac/iPhone) → USB UAC output_cb → ring buffer
 *     → audio task (Core 1) → DSP pipeline → dual I2S TX
 *
 * Architecture mirrors bt_app_core.c from the ESP32 firmware:
 *   - Ring buffer decouples USB isochronous timing from DSP processing
 *   - Audio task pinned to Core 1 for real-time performance
 *   - DSP telemetry posted to msg_handler for transport layer
 */

#include "usb_audio.h"
#include "dsp_config.h"
#include "dsp_param_update.h"
#include "msg_handler.h"
#include "i2s_audio.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/ringbuf.h"
#include "esp_log.h"
#include "esp_heap_caps.h"
#include <string.h>
#include "esp_timer.h"
#include <math.h>
#include "usb_device_uac.h"
#include "sdkconfig.h"

extern void dsp_pipeline_process(const dsp_config_t *cfg, float in_l, float in_r, float out[4]);
extern void dsp_pipeline_reset_filter_states(void);

/* -----------------------------------------------------------------------
 * Sample format helpers — gated on CONFIG_UAC_BIT_DEPTH (Kconfig).
 *
 * Input (USB):  little-endian PCM, 2 bytes/sample (16) or 3 bytes/sample (24).
 * Output (I2S): always int32 MSB-aligned for the 32-bit-slot DAC frame.
 *               PCM5102A latches the upper 24 bits.
 * ----------------------------------------------------------------------- */
#if CONFIG_UAC_BIT_DEPTH == 24
#define UAC_BYTES_PER_SAMPLE 3
static inline float decode_in(const uint8_t *p)
{
    /* Sign-extend from bit 23 into int32, then normalize. */
    int32_t s = ((int32_t)p[0]) | ((int32_t)p[1] << 8) | ((int32_t)(int8_t)p[2] << 16);
    return (float)s / 8388608.0f;  /* 2^23 */
}
#else
#define UAC_BYTES_PER_SAMPLE 2
static inline float decode_in(const uint8_t *p)
{
    int16_t s = (int16_t)((uint16_t)p[0] | ((uint16_t)p[1] << 8));
    return (float)s / 32768.0f;
}
#endif
#define UAC_BYTES_PER_PAIR (UAC_BYTES_PER_SAMPLE * 2)

/**
 * Soft saturation curve — replaces hard clipping at the int16 boundary.
 *
 * Linear (transparent) for |x| ≤ threshold, then smoothly asymptotic to ±1.0.
 * The knee is C1-continuous (derivative = 1 at the threshold), so the
 * transition into saturation is inaudible on transients yet eliminates the
 * harsh odd harmonics that hard clipping injects into the ear-sensitive
 * 2–5 kHz region — a major source of long-listen fatigue.
 *
 *   f(x) = x                                              for |x| ≤ t
 *   f(x) = sign(x) * (1 - (1-t)² / (|x| - 2t + 1))        for |x| > t
 *
 * With t = 0.85 (≈ −1.4 dBFS) the linear region preserves all clean signal
 * dynamics; only true overshoots from EQ boosts or hot masters get shaped.
 * No transcendentals — single division per sample, hot-path friendly.
 */
static inline float soft_clip(float x)
{
    const float t = 0.85f;
    float ax = fabsf(x);
    if (ax <= t) return x;
    float sign = (x < 0.0f) ? -1.0f : 1.0f;
    return sign * (1.0f - (1.0f - t) * (1.0f - t) / (ax - 2.0f * t + 1.0f));
}

static const char *TAG = "usb_audio";

/* -----------------------------------------------------------------------
 * Ring buffer and DMA buffers
 * ----------------------------------------------------------------------- */

/* Sized for 24-bit / 96 kHz stereo.
 *   USB byte rate = 96k * 3 * 2 = 576 KB/s
 *   I2S byte rate = 96k * 4 * 2 = 768 KB/s (int32 frames)
 * Ringbuf 192KB ≈ 333ms at 24/96 USB rate.
 * Scratch buffer 16KB ≈ 21ms of int32 stereo @ 96k — comfortably above the
 * largest ASRC chunk produced per ringbuffer dequeue (≤10ms USB packet).
 * Buffer holds ASRC output between USB and I2S; the I2S driver memcpy's
 * from it into its own DMA descriptors, so MALLOC_CAP_DMA is not required. */
#define USB_AUDIO_RINGBUF_SIZE  (192 * 1024)
#define USB_AUDIO_DMA_BUF_SIZE  (16  * 1024)

static RingbufHandle_t s_ringbuf = NULL;
static uint8_t *s_buf_i2s0 = NULL;
static uint8_t *s_buf_i2s1 = NULL;
static TaskHandle_t s_audio_task_handle = NULL;

/* USB host volume/mute (applied in audio task) */
static volatile float s_usb_volume = 1.0f;
static volatile bool  s_usb_mute = false;

/* Overflow tracking (for diagnostics, read by BLE timer on Core 0) */
static volatile uint32_t s_overflow_count = 0;

/* -----------------------------------------------------------------------
 * PI Controller for USB/I2S clock drift compensation
 *
 * Monitors ring buffer fill level every 100ms (via esp_timer on Core 0).
 * Adjusts I2S sample rate by ±200 ppm to keep buffer at 50% target.
 * ----------------------------------------------------------------------- */

#define DRIFT_TIMER_INTERVAL_US  100000   /* 100ms */

/* Default PI gains — overridden at runtime from dsp_config_t.system */
#define DRIFT_KP_DEFAULT         0.3f
#define DRIFT_KI_DEFAULT         0.05f
#define DRIFT_TARGET_DEFAULT     0.5f
#define DRIFT_MAX_PPM_DEFAULT    200.0f

static float s_drift_integral = 0.0f;
static float s_drift_prev_ki = 0.0f;                  /* detect Ki changes → reset integral */
static float s_drift_prev_kp = 0.0f;                  /* detect Kp changes → reset integral */
static volatile float s_drift_fill_pct = 0.0f;        /* last buffer fill % (for telemetry) */
static volatile float s_drift_correction_ppm = 0.0f;  /* last PI output (for telemetry) */

/**
 * ASRC (Asynchronous Sample Rate Conversion) drift compensation.
 *
 * Instead of dropping/duplicating integer samples (which causes clicks),
 * the PI controller sets a resampling ratio very close to 1.0.  The audio
 * task uses a fractional phase accumulator with linear interpolation to
 * smoothly resample the input stream, eliminating all discontinuities.
 *
 * s_resample_ratio: 1.0 = no correction
 *                   >1.0 = consume input faster (USB clock faster, buffer filling)
 *                   <1.0 = consume input slower (I2S clock faster, buffer draining)
 * Written by PI timer on Core 0, read by audio task on Core 1.
 */
static volatile float s_resample_ratio = 1.0f;

/* ASRC interpolation state (persists across ring buffer chunks, audio task only) */
static float s_asrc_phase  = 1.0f;  /* fractional position; init 1.0 forces first sample load */
static float s_asrc_prev_l = 0.0f;  /* previous input sample (left) */
static float s_asrc_prev_r = 0.0f;  /* previous input sample (right) */
static float s_asrc_cur_l  = 0.0f;  /* current input sample (left) */
static float s_asrc_cur_r  = 0.0f;  /* current input sample (right) */

/* DSP telemetry */
static uint32_t s_dsp_min_us = UINT32_MAX;
static uint32_t s_dsp_max_us = 0;
static uint64_t s_dsp_sum_us = 0;
static uint32_t s_dsp_block_count = 0;
static int64_t  s_dsp_last_report_us = 0;
#define DSP_TELEMETRY_INTERVAL_US  1000000

/* -----------------------------------------------------------------------
 * UAC Callbacks
 * ----------------------------------------------------------------------- */

/**
 * Called by the UAC stack when the host sends audio data (speaker output).
 * Must be non-blocking — just push into the ring buffer.
 */
static esp_err_t uac_output_cb(uint8_t *buf, size_t len, void *arg)
{
    if (!s_ringbuf || len == 0) return ESP_OK;

    /* Only drop at 90% full — PI controller handles normal drift.
     * This is a safety net, not the primary drift mechanism. */
    UBaseType_t free_bytes = xRingbufferGetCurFreeSize(s_ringbuf);
    if (free_bytes < USB_AUDIO_RINGBUF_SIZE / 10) {
        s_overflow_count++;
        return ESP_OK;
    }

    if (xRingbufferSend(s_ringbuf, buf, len, pdMS_TO_TICKS(0)) != pdTRUE) {
        s_overflow_count++;
    }
    return ESP_OK;
}

static void uac_set_mute_cb(uint32_t mute, void *arg)
{
    ESP_LOGI(TAG, "USB host set mute: %lu", (unsigned long)mute);
    s_usb_mute = (mute != 0);
}

static void uac_set_volume_cb(uint32_t volume, void *arg)
{
    ESP_LOGI(TAG, "USB host set volume: %lu", (unsigned long)volume);
    /* Convert 0-100 to logarithmic gain curve matching perceived loudness.
     * Map 0→silence, 100→0dB (unity). Uses 60dB range. */
    if (volume == 0) {
        s_usb_volume = 0.0f;
    } else {
        float db = -60.0f * (1.0f - (float)volume / 100.0f);
        s_usb_volume = powf(10.0f, db / 20.0f);
    }
}

/* -----------------------------------------------------------------------
 * Audio Processing Task (Core 1)
 *
 * Same architecture as bt_i2s_task_handler in the ESP32 firmware:
 * reads PCM from ring buffer, runs DSP pipeline, writes to dual I2S.
 * ----------------------------------------------------------------------- */

static void usb_audio_task(void *arg)
{
    ESP_LOGI(TAG, "USB audio DSP task started on core %d", xPortGetCoreID());

    for (;;) {
        size_t item_size = 0;
        uint8_t *data = (uint8_t *)xRingbufferReceive(s_ringbuf, &item_size, portMAX_DELAY);
        if (data == NULL || item_size == 0) {
            continue;
        }

        /* If Core 0 is recalculating coefficients, output silence.
         * Silence size mirrors the input duration but in I2S output units
         * (8 bytes/pair: stereo int32). */
        if (dsp_param_is_recalculating()) {
            size_t silence_pairs = item_size / UAC_BYTES_PER_PAIR;
            size_t silence_bytes = silence_pairs * 8;
            if (silence_bytes > USB_AUDIO_DMA_BUF_SIZE) silence_bytes = USB_AUDIO_DMA_BUF_SIZE;
            memset(s_buf_i2s0, 0, silence_bytes);
            memset(s_buf_i2s1, 0, silence_bytes);
            i2s_audio_write_dual(s_buf_i2s0, s_buf_i2s1, silence_bytes);
            vRingbufferReturnItem(s_ringbuf, (void *)data);
            continue;
        }

        /* DSP parameter update: commit + reset filter states. */
        if (dsp_param_poll_update()) {
            dsp_param_commit();
            dsp_pipeline_reset_filter_states();
        }

        const dsp_config_t *cfg = dsp_param_get_active();

        const uint8_t *in = data;
        int32_t *out0 = (int32_t *)s_buf_i2s0;
        int32_t *out1 = (int32_t *)s_buf_i2s1;

        int64_t t0 = esp_timer_get_time();

        /* ASRC: resample interleaved stereo via fractional phase accumulator
         * with linear interpolation. Input is 24-bit LE decoded to float; output
         * is int32 MSB-aligned for a 32-bit I2S slot. PI controller on Core 0
         * sets s_resample_ratio ≈ 1.0 ± 200ppm. */
        float uv = s_usb_mute ? 0.0f : s_usb_volume;
        float ratio = s_resample_ratio;
        size_t num_pairs = item_size / UAC_BYTES_PER_PAIR;
        size_t in_idx = 0;
        size_t out_bytes = 0;

        while (out_bytes + 8 <= USB_AUDIO_DMA_BUF_SIZE) {
            while (s_asrc_phase >= 1.0f) {
                if (in_idx < num_pairs) {
                    s_asrc_phase -= 1.0f;
                    s_asrc_prev_l = s_asrc_cur_l;
                    s_asrc_prev_r = s_asrc_cur_r;
                    const uint8_t *p = in + in_idx * UAC_BYTES_PER_PAIR;
                    s_asrc_cur_l = decode_in(p);
                    s_asrc_cur_r = decode_in(p + UAC_BYTES_PER_SAMPLE);
                    in_idx++;
                } else {
                    goto asrc_done;
                }
            }

            float frac = s_asrc_phase;
            float interp_l = s_asrc_prev_l + frac * (s_asrc_cur_l - s_asrc_prev_l);
            float interp_r = s_asrc_prev_r + frac * (s_asrc_cur_r - s_asrc_prev_r);

            float dsp_out[4];
            dsp_pipeline_process(cfg, interp_l, interp_r, dsp_out);

            int32_t s24[4];
            for (int ch = 0; ch < 4; ch++) {
                float s = soft_clip(dsp_out[ch]) * uv;
                s24[ch] = (int32_t)(s * 8388607.0f);
            }

            *out0++ = s24[0] << 8;
            *out0++ = s24[1] << 8;
            *out1++ = s24[2] << 8;
            *out1++ = s24[3] << 8;
            out_bytes += 8;

            s_asrc_phase += ratio;
        }
asrc_done: ;

        /* DSP telemetry */
        int64_t elapsed_us = esp_timer_get_time() - t0;
        uint32_t elapsed = (uint32_t)elapsed_us;
        if (elapsed < s_dsp_min_us) s_dsp_min_us = elapsed;
        if (elapsed > s_dsp_max_us) s_dsp_max_us = elapsed;
        s_dsp_sum_us += elapsed;
        s_dsp_block_count++;

        int64_t now = esp_timer_get_time();
        if (now - s_dsp_last_report_us >= DSP_TELEMETRY_INTERVAL_US) {
            if (s_dsp_block_count > 0) {
                dsp_telemetry_t stats = {
                    .dsp_min_us = s_dsp_min_us,
                    .dsp_max_us = s_dsp_max_us,
                    .dsp_avg_us = (uint32_t)(s_dsp_sum_us / s_dsp_block_count),
                    .blocks_processed = s_dsp_block_count,
                    .buffer_fill_pct = (uint8_t)s_drift_fill_pct,
                    .correction_ppm = s_drift_correction_ppm,
                };
                msg_handler_post_telemetry(&stats);
            }

            s_dsp_min_us = UINT32_MAX;
            s_dsp_max_us = 0;
            s_dsp_sum_us = 0;
            s_dsp_block_count = 0;
            s_dsp_last_report_us = now;
        }

        if (out_bytes > 0) {
            i2s_audio_write_dual(s_buf_i2s0, s_buf_i2s1, out_bytes);
        }

        vRingbufferReturnItem(s_ringbuf, (void *)data);
    }
}

/* -----------------------------------------------------------------------
 * Drift Compensation Timer (runs on Core 0 via esp_timer)
 *
 * Reads ring buffer fill level every 100ms. Computes error vs 50% target.
 * Applies PI controller to derive sample rate correction in ppm.
 * Sets ASRC resampling ratio for smooth fractional interpolation.
 * ----------------------------------------------------------------------- */

static void drift_compensation_cb(void *arg)
{
    if (!s_ringbuf) return;

    /* Read PI gains from active config (tunable via BLE/serial UI) */
    const dsp_config_t *cfg = dsp_param_get_active();
    float kp         = cfg->system.drift_kp > 0.0f          ? cfg->system.drift_kp          : DRIFT_KP_DEFAULT;
    float ki         = cfg->system.drift_ki > 0.0f          ? cfg->system.drift_ki          : DRIFT_KI_DEFAULT;
    float target     = cfg->system.drift_target_fill > 0.0f ? cfg->system.drift_target_fill : DRIFT_TARGET_DEFAULT;
    float max_ppm    = cfg->system.drift_max_ppm > 0.0f     ? cfg->system.drift_max_ppm     : DRIFT_MAX_PPM_DEFAULT;

    /* Reset integral when PI gains change (prevents windup from stale state) */
    if (kp != s_drift_prev_kp || ki != s_drift_prev_ki) {
        s_drift_integral = 0.0f;
        s_drift_prev_kp = kp;
        s_drift_prev_ki = ki;
    }

    UBaseType_t free = xRingbufferGetCurFreeSize(s_ringbuf);
    float fill = 1.0f - (float)free / (float)USB_AUDIO_RINGBUF_SIZE;

    /* PI controller: error is positive when buffer is too full (USB faster) */
    float error = fill - target;
    s_drift_integral += error;

    /* Clamp integral to prevent windup */
    float max_integral = (ki > 0.001f) ? max_ppm / ki : max_ppm * 1000.0f;
    if (s_drift_integral > max_integral) s_drift_integral = max_integral;
    if (s_drift_integral < -max_integral) s_drift_integral = -max_integral;

    float correction = kp * error * 100.0f + ki * s_drift_integral;
    if (correction > max_ppm) correction = max_ppm;
    if (correction < -max_ppm) correction = -max_ppm;

    /* Convert ppm correction to ASRC resampling ratio.
     * ratio >1.0 = consume input faster (USB faster, buffer filling)
     * ratio <1.0 = consume input slower (I2S faster, buffer draining) */
    s_resample_ratio = 1.0f + correction / 1000000.0f;

    /* Snapshot for telemetry (read by audio task on Core 1) */
    s_drift_fill_pct = fill * 100.0f;
    s_drift_correction_ppm = correction;
}

/* -----------------------------------------------------------------------
 * Public API
 * ----------------------------------------------------------------------- */

esp_err_t usb_audio_init(uint32_t sample_rate)
{
    /* Allocate ring buffer in internal RAM for fast USB callback access */
    s_ringbuf = xRingbufferCreate(USB_AUDIO_RINGBUF_SIZE, RINGBUF_TYPE_BYTEBUF);
    if (!s_ringbuf) {
        ESP_LOGE(TAG, "Failed to create ring buffer");
        return ESP_ERR_NO_MEM;
    }

    /* Allocate DMA-capable I2S output buffers */
    s_buf_i2s0 = heap_caps_malloc(USB_AUDIO_DMA_BUF_SIZE, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    s_buf_i2s1 = heap_caps_malloc(USB_AUDIO_DMA_BUF_SIZE, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    if (!s_buf_i2s0 || !s_buf_i2s1) {
        ESP_LOGE(TAG, "Failed to allocate I2S DMA buffers");
        return ESP_ERR_NO_MEM;
    }

    /* TEMP REVERT: composite UAC + WebUSB Vendor descriptor was breaking
     * macOS audio HAL binding. Going back to UAC-only (component owns
     * tinyusb + descriptor) so audio works again. The composite path will
     * come back once the descriptor layout is verified against actual
     * macOS enumeration logs. */
    uac_device_config_t uac_cfg = {
        .output_cb     = uac_output_cb,
        .input_cb      = NULL,
        .set_mute_cb   = uac_set_mute_cb,
        .set_volume_cb = uac_set_volume_cb,
        .cb_ctx        = NULL,
    };

    esp_err_t err = uac_device_init(&uac_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "UAC device init failed: %s", esp_err_to_name(err));
        return err;
    }

    /* Start drift compensation PI controller (100ms interval, Core 0) */
    const esp_timer_create_args_t drift_timer_args = {
        .callback = drift_compensation_cb,
        .name = "drift_pi",
    };
    esp_timer_handle_t drift_timer;
    esp_timer_create(&drift_timer_args, &drift_timer);
    esp_timer_start_periodic(drift_timer, DRIFT_TIMER_INTERVAL_US);

    ESP_LOGI(TAG, "USB Audio initialized (stereo, %d-bit, %lu Hz, drift PI active)",
             CONFIG_UAC_BIT_DEPTH, (unsigned long)sample_rate);
    return ESP_OK;
}

void usb_audio_start(void)
{
    /* Launch audio processing task on Core 1 */
    xTaskCreatePinnedToCore(
        usb_audio_task,
        "UsbAudioT",
        4096,
        NULL,
        configMAX_PRIORITIES - 3,
        &s_audio_task_handle,
        1   /* Core 1 for real-time audio */
    );

    ESP_LOGI(TAG, "USB audio streaming started");
}

void usb_audio_stop(void)
{
    if (s_audio_task_handle) {
        vTaskDelete(s_audio_task_handle);
        s_audio_task_handle = NULL;
    }

    if (s_ringbuf) {
        vRingbufferDelete(s_ringbuf);
        s_ringbuf = NULL;
    }

    if (s_buf_i2s0) {
        heap_caps_free(s_buf_i2s0);
        s_buf_i2s0 = NULL;
    }
    if (s_buf_i2s1) {
        heap_caps_free(s_buf_i2s1);
        s_buf_i2s1 = NULL;
    }

    ESP_LOGI(TAG, "USB audio stopped");
}
