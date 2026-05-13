/**
 * UART Serial Server for ESP32-S3
 *
 * Receives serial frames (0xAA 0x55 framing with CRC-8) via the
 * USB-UART bridge and routes payloads through msg_handler.
 * Also redirects ESP_LOG output into serial frames.
 */

#include "serial_server.h"
#include "serial_protocol.h"
#include "ble_protocol.h"
#include "msg_handler.h"
#include "dsp_param_update.h"
#include "dsp_config.h"

#include "driver/uart.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <string.h>
#include <stdio.h>
#include <stdarg.h>

static const char *TAG = "serial_server";

#define SERIAL_UART_NUM       UART_NUM_0
#define SERIAL_RX_BUF_SIZE    256
#define SERIAL_TX_BUF_SIZE    0
#define SERIAL_RX_TASK_STACK  4096
#define SERIAL_RX_TASK_PRIO   3
#define SERIAL_RX_TASK_CORE   0

static TaskHandle_t rx_task_handle = NULL;
static volatile bool rx_task_running = false;

/* -----------------------------------------------------------------------
 * UART TX
 * ----------------------------------------------------------------------- */

static void serial_send_frame(const uint8_t *payload, uint8_t payload_len)
{
    uint8_t frame[SERIAL_MAX_FRAME_SIZE];
    size_t frame_len = serial_frame_encode(payload, payload_len, frame);
    if (frame_len == 0) return;
    uart_write_bytes(SERIAL_UART_NUM, frame, frame_len);
}

/* -----------------------------------------------------------------------
 * msg_transport_t callbacks
 * ----------------------------------------------------------------------- */

static void serial_transport_send_ack(uint8_t msg_id, uint8_t status_code)
{
    ble_ack_msg_t ack = {
        .msg_id      = msg_id,
        .msg_type    = BLE_MSG_ACK,
        .status_code = status_code,
    };
    serial_send_frame((const uint8_t *)&ack, sizeof(ack));
}

static void serial_transport_send_error(uint8_t msg_id, uint8_t status_code, uint8_t detail)
{
    ble_error_msg_t err = {
        .msg_id      = msg_id,
        .msg_type    = BLE_MSG_ERROR,
        .status_code = status_code,
        .detail      = detail,
    };
    serial_send_frame((const uint8_t *)&err, sizeof(err));
}

static void serial_transport_send_config(const uint8_t *data, size_t total)
{
    size_t offset = 0;

    uint8_t first_payload[SERIAL_MAX_PAYLOAD_SIZE];
    first_payload[0] = 0;
    first_payload[1] = BLE_MSG_BULK_CONFIG;
    first_payload[2] = (uint8_t)(total & 0xFF);
    first_payload[3] = (uint8_t)(total >> 8);

    size_t first_chunk = SERIAL_MAX_PAYLOAD_SIZE - 4;
    if (first_chunk > total) first_chunk = total;
    memcpy(&first_payload[4], data, first_chunk);
    serial_send_frame(first_payload, (uint8_t)(4 + first_chunk));
    offset += first_chunk;

    while (offset < total) {
        size_t chunk = total - offset;
        if (chunk > SERIAL_MAX_PAYLOAD_SIZE) chunk = SERIAL_MAX_PAYLOAD_SIZE;
        serial_send_frame(data + offset, (uint8_t)chunk);
        offset += chunk;
    }
}

static void serial_transport_send_telemetry(const dsp_telemetry_t *stats)
{
    uint8_t payload[1 + sizeof(dsp_telemetry_t)];
    payload[0] = SERIAL_MSG_TELEMETRY;
    memcpy(&payload[1], stats, sizeof(dsp_telemetry_t));
    serial_send_frame(payload, sizeof(payload));
}

static const msg_transport_t serial_transport = {
    .send_ack       = serial_transport_send_ack,
    .send_error     = serial_transport_send_error,
    .send_config    = serial_transport_send_config,
    .send_telemetry = serial_transport_send_telemetry,
};

/* -----------------------------------------------------------------------
 * PONG
 * ----------------------------------------------------------------------- */

static void send_pong(void)
{
    uint8_t payload = SERIAL_MSG_PONG;
    serial_send_frame(&payload, 1);
}

/* -----------------------------------------------------------------------
 * ESP_LOG Redirection
 * ----------------------------------------------------------------------- */

static int serial_log_vprintf(const char *fmt, va_list args)
{
    static bool in_log = false;
    if (in_log) return vprintf(fmt, args);
    in_log = true;

    char buf[SERIAL_MAX_PAYLOAD_SIZE - 1];
    int len = vsnprintf(buf, sizeof(buf), fmt, args);
    if (len <= 0) { in_log = false; return len; }
    if (len >= (int)sizeof(buf)) len = (int)sizeof(buf) - 1;

    uint8_t payload[SERIAL_MAX_PAYLOAD_SIZE];
    payload[0] = SERIAL_MSG_LOG;
    memcpy(&payload[1], buf, len);
    serial_send_frame(payload, (uint8_t)(1 + len));

    in_log = false;
    return len;
}

/* -----------------------------------------------------------------------
 * RX Task
 * ----------------------------------------------------------------------- */

typedef enum {
    RX_STATE_SYNC0,
    RX_STATE_SYNC1,
    RX_STATE_LENGTH,
    RX_STATE_PAYLOAD,
    RX_STATE_CRC,
} rx_state_t;

static void serial_rx_task(void *pvParameters)
{
    ESP_LOGI(TAG, "Serial RX task started on core %d", xPortGetCoreID());

    uint8_t frame_buf[SERIAL_MAX_FRAME_SIZE];
    rx_state_t state = RX_STATE_SYNC0;
    uint8_t payload_len = 0;
    uint8_t payload_idx = 0;

    while (rx_task_running) {
        msg_handler_flush_telemetry();

        uint8_t byte;
        int read = uart_read_bytes(SERIAL_UART_NUM, &byte, 1, pdMS_TO_TICKS(20));
        if (read <= 0) continue;

        switch (state) {
        case RX_STATE_SYNC0:
            if (byte == SERIAL_FRAME_HEADER_0) {
                frame_buf[0] = byte;
                state = RX_STATE_SYNC1;
            }
            break;

        case RX_STATE_SYNC1:
            if (byte == SERIAL_FRAME_HEADER_1) {
                frame_buf[1] = byte;
                state = RX_STATE_LENGTH;
            } else if (byte == SERIAL_FRAME_HEADER_0) {
                frame_buf[0] = byte;
            } else {
                state = RX_STATE_SYNC0;
            }
            break;

        case RX_STATE_LENGTH:
            payload_len = byte;
            frame_buf[2] = byte;
            payload_idx = 0;
            if (payload_len > SERIAL_MAX_PAYLOAD_SIZE) {
                state = RX_STATE_SYNC0;
            } else if (payload_len == 0) {
                state = RX_STATE_CRC;
            } else {
                state = RX_STATE_PAYLOAD;
            }
            break;

        case RX_STATE_PAYLOAD:
            frame_buf[3 + payload_idx] = byte;
            payload_idx++;
            if (payload_idx >= payload_len) state = RX_STATE_CRC;
            break;

        case RX_STATE_CRC: {
            frame_buf[3 + payload_len] = byte;
            uint8_t expected_crc = byte;
            uint8_t actual_crc = serial_crc8(&frame_buf[2], 1 + payload_len);

            if (actual_crc == expected_crc) {
                uint8_t first_byte = frame_buf[3];
                if (first_byte == SERIAL_MSG_PING) {
                    send_pong();
                } else {
                    msg_handler_process(&frame_buf[3], payload_len);
                }
            }
            state = RX_STATE_SYNC0;
            break;
        }
        }
    }

    vTaskDelete(NULL);
}

/* -----------------------------------------------------------------------
 * Public API
 * ----------------------------------------------------------------------- */

esp_err_t serial_server_init(void)
{
    uart_config_t uart_config = {
        .baud_rate  = SERIAL_BAUD_RATE,
        .data_bits  = UART_DATA_8_BITS,
        .parity     = UART_PARITY_DISABLE,
        .stop_bits  = UART_STOP_BITS_1,
        .flow_ctrl  = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };

    esp_err_t err = uart_param_config(SERIAL_UART_NUM, &uart_config);
    if (err != ESP_OK) return err;

    err = uart_driver_install(SERIAL_UART_NUM, SERIAL_RX_BUF_SIZE,
                              SERIAL_TX_BUF_SIZE, 0, NULL, 0);
    if (err != ESP_OK) return err;

    msg_handler_init(&serial_transport);

    ESP_LOGI(TAG, "Serial server initialized (UART%d, %d baud)", SERIAL_UART_NUM, SERIAL_BAUD_RATE);
    return ESP_OK;
}

void serial_server_start(void)
{
    if (rx_task_handle != NULL) return;

    rx_task_running = true;
    xTaskCreatePinnedToCore(
        serial_rx_task, "serial_rx",
        SERIAL_RX_TASK_STACK, NULL,
        SERIAL_RX_TASK_PRIO, &rx_task_handle,
        SERIAL_RX_TASK_CORE
    );

    ESP_LOGI(TAG, "Serial server started");
}

void serial_server_attach_logs(void)
{
    esp_log_set_vprintf(serial_log_vprintf);
}

void serial_server_stop(void)
{
    if (rx_task_handle == NULL) return;
    rx_task_running = false;
    vTaskDelay(pdMS_TO_TICKS(100));
    rx_task_handle = NULL;
}
