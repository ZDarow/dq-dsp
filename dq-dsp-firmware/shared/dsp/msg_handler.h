/**
 * Transport-agnostic DSP message router.
 *
 * Parses BLE-protocol messages (param updates, bulk config, sync, ping)
 * and applies them to the DSP parameter engine.  The transport layer
 * (UART serial or BLE GATTS) provides send callbacks via msg_transport_t.
 *
 * This module is shared by both ESP32 (serial) and ESP32-S3 (BLE) firmwares.
 */

#ifndef MSG_HANDLER_H
#define MSG_HANDLER_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include "serial_protocol.h"

/**
 * Transport callback interface.
 *
 * Each transport (serial, BLE) implements these to send responses
 * back to the connected client.
 */
typedef struct {
    void (*send_ack)(uint8_t msg_id, uint8_t status);
    void (*send_error)(uint8_t msg_id, uint8_t status, uint8_t detail);
    void (*send_config)(const uint8_t *data, size_t len);
    void (*send_telemetry)(const dsp_telemetry_t *stats);
} msg_transport_t;

/**
 * Initialize the message handler with transport callbacks.
 * Must be called once before msg_handler_process().
 */
void msg_handler_init(const msg_transport_t *transport);

/**
 * Process an incoming message payload.
 *
 * Called by the transport layer for each received message.
 * Handles: PARAM_UPDATE, BULK_CONFIG, PING, SYNC_CONFIG.
 *
 * @param payload   Raw payload bytes (after transport framing is stripped).
 * @param len       Payload length.
 */
void msg_handler_process(const uint8_t *payload, uint8_t len);

/**
 * Post telemetry from the audio task (lock-free).
 *
 * Called from the real-time audio task on Core 1.  The data is
 * picked up by the transport task via msg_handler_flush_telemetry().
 */
void msg_handler_post_telemetry(const dsp_telemetry_t *stats);

/**
 * Flush pending telemetry through the transport.
 *
 * Should be called periodically from the transport task (Core 0).
 * Returns true if telemetry was sent.
 */
bool msg_handler_flush_telemetry(void);

#endif /* MSG_HANDLER_H */
