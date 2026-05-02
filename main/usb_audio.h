/**
 * USB Audio Class (UAC) Device Driver for ESP32-S3
 *
 * Receives stereo PCM audio from the USB host (Mac/iPhone) and routes
 * it through the DSP pipeline to dual I2S outputs.
 *
 * Replaces bt_app_core.c + bt_app_av.c from the ESP32 firmware.
 */

#ifndef USB_AUDIO_H
#define USB_AUDIO_H

#include <stdint.h>
#include "esp_err.h"

/**
 * Initialize the USB Audio Class device.
 *
 * Sets up UAC1 speaker endpoint (stereo, 16-bit) and creates the
 * audio processing ring buffer.  Does NOT start audio streaming yet.
 *
 * @param sample_rate  Audio sample rate in Hz (e.g. 48000).
 * @return ESP_OK on success.
 */
esp_err_t usb_audio_init(uint32_t sample_rate);

/**
 * Start USB audio streaming.
 *
 * Launches the audio processing task on Core 1 that reads from the
 * ring buffer, processes through the DSP pipeline, and writes to I2S.
 */
void usb_audio_start(void);

/**
 * Stop USB audio streaming and release resources.
 */
void usb_audio_stop(void);

#endif /* USB_AUDIO_H */
