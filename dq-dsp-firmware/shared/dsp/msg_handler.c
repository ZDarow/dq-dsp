/**
 * Transport-agnostic DSP message router.
 *
 * Extracted from serial_server.c handle_payload() so both the
 * UART serial transport (ESP32) and BLE GATTS transport (ESP32-S3)
 * share identical message parsing, param apply, and bulk config logic.
 */

#include "msg_handler.h"
#include "ble_protocol.h"
#include "dsp_config.h"
#include "dsp_param_update.h"

#include "esp_log.h"
#include "esp_timer.h"
#include <string.h>

/* NVS save function from main.c */
extern void save_config_to_nvs_immediate(void);

static const char *TAG = "msg_handler";

/* -----------------------------------------------------------------------
 * State
 * ----------------------------------------------------------------------- */

static const msg_transport_t *s_transport = NULL;

/** Bulk config receive buffer. */
static uint8_t bulk_buffer[sizeof(dsp_config_t)];
static size_t  bulk_offset = 0;
static size_t  bulk_expected = sizeof(dsp_config_t);

/** Stall timeout for a partially received bulk config (µs): if no
 *  continuation frame arrives within this window the transfer is aborted so
 *  a host that stops mid-transfer cannot wedge the device in bulk mode
 *  forever (audit M4). Monotonic via esp_timer. */
#define BULK_RX_STALL_TIMEOUT_US (1000000LL)  /* 1 s */
static int64_t bulk_last_frame_time = 0;

/** Telemetry shared state (written by audio task, read by transport task). */
static volatile bool s_telemetry_pending = false;
static dsp_telemetry_t s_telemetry_snapshot;

/* -----------------------------------------------------------------------
 * Init
 * ----------------------------------------------------------------------- */

void msg_handler_init(const msg_transport_t *transport)
{
    s_transport = transport;
    bulk_offset = 0;
    bulk_last_frame_time = 0;
    s_telemetry_pending = false;
}

/* -----------------------------------------------------------------------
 * Telemetry (lock-free cross-core posting)
 * ----------------------------------------------------------------------- */

void msg_handler_post_telemetry(const dsp_telemetry_t *stats)
{
    memcpy(&s_telemetry_snapshot, stats, sizeof(dsp_telemetry_t));
    s_telemetry_pending = true;
}

bool msg_handler_flush_telemetry(void)
{
    if (!s_telemetry_pending || !s_transport || !s_transport->send_telemetry) {
        return false;
    }
    s_telemetry_pending = false;
    s_transport->send_telemetry(&s_telemetry_snapshot);
    return true;
}

/* -----------------------------------------------------------------------
 * Send Current Config (SYNC_CONFIG Response)
 * ----------------------------------------------------------------------- */

static void send_current_config(void)
{
    const dsp_config_t *cfg = dsp_param_get_active();
    if (!cfg) {
        if (s_transport->send_error) {
            s_transport->send_error(0, BLE_STATUS_BUSY, 0);
        }
        return;
    }

    /* Snapshot into a local buffer and refresh the CRC there: the bytes that
     * go out must always match their checksum, and the active config buffer
     * (read lock-free by the audio task) is never written from here. */
    static dsp_config_t snapshot;
    memcpy(&snapshot, cfg, sizeof(snapshot));
    dsp_param_refresh_crc_in_place(&snapshot);

    if (s_transport->send_config) {
        s_transport->send_config((const uint8_t *)&snapshot, sizeof(snapshot));
    }

    if (s_transport->send_ack) {
        s_transport->send_ack(0, BLE_STATUS_OK);
    }
    ESP_LOGI(TAG, "SYNC_CONFIG: sent %d bytes", (int)sizeof(dsp_config_t));
}

/* -----------------------------------------------------------------------
 * Message Router
 * ----------------------------------------------------------------------- */

void msg_handler_process(const uint8_t *payload, uint8_t payload_len)
{
    if (payload_len == 0 || !s_transport) {
        return;
    }

    /*
     * If a bulk transfer is in progress, ALL incoming payloads are
     * continuation data — regardless of what the raw bytes look like.
     * This must be checked before the single-byte control messages: bulk
     * chunks are raw config bytes, and any of them could coincidentally equal
     * SERIAL_MSG_PING/SYNC_CONFIG/SAVE_CONFIG. Complete once we reach the
     * size advertised by the host in the first frame (validated at
     * BLE_MSG_BULK_CONFIG), so a version-skewed host can never wedge the
     * device into permanent bulk mode.
     */
    if (bulk_offset > 0) {
        int64_t now = esp_timer_get_time();

        /* Abort a stalled transfer: bulk mode must not be permanent. */
        if ((now - bulk_last_frame_time) > BULK_RX_STALL_TIMEOUT_US) {
            ESP_LOGW(TAG, "Bulk config stalled, aborting (offset=%d/%d)",
                     (int)bulk_offset, (int)bulk_expected);
            bulk_offset = 0;
            bulk_last_frame_time = 0;
            /* Fall through: treat this payload as a fresh message. */
        } else {
            bulk_last_frame_time = now;
            if (bulk_offset + payload_len > sizeof(bulk_buffer)) {
                ESP_LOGE(TAG, "Bulk buffer overflow (offset=%d, chunk=%d)",
                         (int)bulk_offset, payload_len);
                bulk_offset = 0;
                if (s_transport->send_error) {
                    s_transport->send_error(0, BLE_STATUS_OUT_OF_RANGE, 0);
                }
                return;
            }
            memcpy(bulk_buffer + bulk_offset, payload, payload_len);
            bulk_offset += payload_len;

            if (bulk_offset >= bulk_expected) {
                uint8_t status = dsp_param_apply_bulk(bulk_buffer, bulk_expected);
                bulk_offset = 0;
                if (status == BLE_STATUS_OK) {
                    if (s_transport->send_ack) {
                        s_transport->send_ack(0, BLE_STATUS_OK);
                    }
                    ESP_LOGI(TAG, "Bulk config applied successfully");
                } else {
                    if (s_transport->send_error) {
                        s_transport->send_error(0, status, 0);
                    }
                }
            }
            return;
        }
    }

    uint8_t first_byte = payload[0];

    /* --- Serial-specific control messages (also usable over BLE) ---
     * Guarded by payload_len == 1: a param update whose msg_id collides with
     * 0xA0/0xA2/0xA5 (host msg_ids cycle 0..255) always carries a msg_type
     * byte, so it can never be mistaken for one of these. */
    if (first_byte == SERIAL_MSG_PING && payload_len == 1) {
        /* Transport handles PONG response directly if needed */
        if (s_transport->send_ack) {
            s_transport->send_ack(0, BLE_STATUS_OK);
        }
        return;
    }

    if (first_byte == SERIAL_MSG_SYNC_CONFIG && payload_len == 1) {
        send_current_config();
        return;
    }

    if (first_byte == SERIAL_MSG_SAVE_CONFIG && payload_len == 1) {
        save_config_to_nvs_immediate();
        if (s_transport->send_ack) {
            s_transport->send_ack(0, BLE_STATUS_OK);
        }
        ESP_LOGI(TAG, "Config saved to NVS (explicit save)");
        return;
    }

    /* --- BLE-compatible messages (need at least 2 bytes) --- */
    if (payload_len < 2) {
        if (s_transport->send_error) {
            s_transport->send_error(0, BLE_STATUS_INVALID_PARAM, 0);
        }
        return;
    }

    uint8_t msg_id   = payload[0];
    uint8_t msg_type = payload[1];

    switch (msg_type) {

    case BLE_MSG_PARAM_UPDATE: {
        uint8_t status = dsp_param_apply(payload, payload_len);
        if (status == BLE_STATUS_OK) {
            dsp_param_notify_update();
            if (s_transport->send_ack) {
                s_transport->send_ack(msg_id, BLE_STATUS_OK);
            }
            /* NVS save deferred — flash write disables instruction cache on both
             * cores causing audio glitches. Save explicitly via SYNC_CONFIG or
             * "Save" button in web UI instead. */
        } else {
            if (s_transport->send_error) {
                s_transport->send_error(msg_id, status, 0);
            }
        }
        break;
    }

    case BLE_MSG_BULK_CONFIG: {
        /* First frame: [msg_id, msg_type, size_lo, size_hi, ...data] */
        if (payload_len < 4) {
            if (s_transport->send_error) {
                s_transport->send_error(msg_id, BLE_STATUS_INVALID_PARAM, 0);
            }
            break;
        }

        size_t advertised = payload[2] | ((size_t)payload[3] << 8);
        if (advertised != sizeof(dsp_config_t)) {
            ESP_LOGW(TAG, "Bulk config size mismatch: host %d vs firmware %d",
                     (int)advertised, (int)sizeof(dsp_config_t));
            bulk_offset = 0;
            if (s_transport->send_error) {
                s_transport->send_error(msg_id, BLE_STATUS_INVALID_PARAM, 0);
            }
            break;
        }

        bulk_offset = 0;
        bulk_expected = advertised;
        bulk_last_frame_time = esp_timer_get_time();

        if (payload_len > 4) {
            size_t chunk = payload_len - 4;
            if (chunk <= sizeof(bulk_buffer)) {
                memcpy(bulk_buffer, payload + 4, chunk);
                bulk_offset = chunk;
            }
        }
        ESP_LOGI(TAG, "Bulk config transfer started (%d initial bytes)", (int)bulk_offset);

        if (bulk_offset >= bulk_expected) {
            uint8_t status = dsp_param_apply_bulk(bulk_buffer, bulk_expected);
            bulk_offset = 0;
            if (status == BLE_STATUS_OK) {
                if (s_transport->send_ack) {
                    s_transport->send_ack(msg_id, BLE_STATUS_OK);
                }
                ESP_LOGI(TAG, "Bulk config applied successfully");
            } else {
                if (s_transport->send_error) {
                    s_transport->send_error(msg_id, status, 0);
                }
            }
        }
        break;
    }

    default:
        ESP_LOGW(TAG, "Unknown msg_type 0x%02X", msg_type);
        if (s_transport->send_error) {
            s_transport->send_error(msg_id, BLE_STATUS_INVALID_PARAM, 0);
        }
        break;
    }
}
