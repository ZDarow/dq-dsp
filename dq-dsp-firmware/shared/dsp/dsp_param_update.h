/**
 * Thread-Safe Live DSP Parameter Update Engine
 *
 * Provides double-buffered dsp_config_t management for lock-free
 * coefficient access from the real-time audio task, while allowing
 * the BLE task to safely modify a staging copy.
 *
 * Architecture:
 *   BLE task  -> dsp_param_apply()  -> writes to staging_config
 *                dsp_param_commit() -> swaps staging <-> active pointer
 *   Audio task -> dsp_param_get_active() -> reads active_config (lock-free)
 *
 * Biquad coefficient recalculation happens in BLE task context so it
 * never blocks the audio processing loop.
 */

#ifndef DSP_PARAM_UPDATE_H
#define DSP_PARAM_UPDATE_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include "dsp_config.h"
#include "esp_err.h"

/**
 * Initialize the parameter update engine with a starting configuration.
 * Both the active and staging buffers are set to a copy of *initial.
 *
 * @param initial  Pointer to the initial configuration to copy.
 * @return ESP_OK on success, error code otherwise.
 */
esp_err_t dsp_param_init(const dsp_config_t *initial);

/**
 * Get pointer to the currently active config (called by audio task).
 * This is a lock-free read of an atomically-swapped pointer.
 *
 * @return Pointer to the active dsp_config_t. Never NULL after init.
 */
const dsp_config_t *dsp_param_get_active(void);

/**
 * Parse a BLE parameter update message and apply it to the staging config.
 * Recalculates biquad coefficients if EQ/crossover parameters change.
 * Called from BLE task context.
 *
 * @param msg  Raw BLE message bytes (header + value).
 * @param len  Length of the message.
 * @return BLE_STATUS_OK on success, or a BLE_STATUS_* error code.
 */
uint8_t dsp_param_apply(const uint8_t *msg, uint16_t len);

/**
 * Atomically swap the staging config to become the active config.
 * The old active buffer becomes the new staging buffer.
 * Should be called after one or more dsp_param_apply() calls.
 */
void dsp_param_commit(void);

/**
 * Apply a full binary config (bulk transfer).
 * Validates the binary, copies to staging, and commits.
 *
 * @param data  Pointer to the raw dsp_config_t binary.
 * @param len   Length of the data.
 * @return BLE_STATUS_OK on success, or a BLE_STATUS_* error code.
 */
uint8_t dsp_param_apply_bulk(const uint8_t *data, size_t len);

/**
 * Notify the audio task that new parameters are available.
 * Called by the BLE task after dsp_param_apply() + coefficient recalc.
 * Posts to an internal FreeRTOS queue.
 */
void dsp_param_notify_update(void);

/**
 * Check for and consume a pending update notification.
 * Non-blocking; called by the audio task between frames.
 *
 * @return true if an update was pending (caller should call dsp_param_commit).
 */
bool dsp_param_poll_update(void);

/**
 * Refresh the CRC32 in a config buffer so a config sent to the host
 * (SYNC_CONFIG) always carries a valid checksum, even after live parameter
 * edits. The caller passes a snapshot buffer (NOT the active config, which
 * the audio task reads lock-free), fills it via memcpy, then calls this
 * before serializing.
 */
void dsp_param_refresh_crc_in_place(dsp_config_t *cfg);

#endif /* DSP_PARAM_UPDATE_H */
