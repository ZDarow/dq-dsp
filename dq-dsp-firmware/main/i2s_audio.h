/*
 * Dual I2S TX Output Driver (ESP32-S3)
 *
 * Same API as ESP32 version, different GPIO defaults via Kconfig.
 */

#ifndef I2S_AUDIO_H
#define I2S_AUDIO_H

#include <stdint.h>
#include <stddef.h>
#include "esp_err.h"

esp_err_t i2s_audio_init_dual_output(uint32_t sample_rate);
void i2s_audio_write_dual(const uint8_t *buf_i2s0, const uint8_t *buf_i2s1, size_t size);
void i2s_audio_reconfig_sample_rate(int sample_rate);
void i2s_audio_deinit(void);

#endif /* I2S_AUDIO_H */
