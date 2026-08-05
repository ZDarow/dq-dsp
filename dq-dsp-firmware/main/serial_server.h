/**
 * UART Serial Server for Live DSP Parameter Updates (ESP32-S3)
 *
 * Provides a serial transport via the USB-UART bridge for
 * parameter updates, bulk config transfer, and device status.
 * Uses the same dsp_param_apply() path as the BLE server.
 */

#ifndef SERIAL_SERVER_H
#define SERIAL_SERVER_H

#include <stdint.h>
#include "esp_err.h"
#include "serial_protocol.h"

esp_err_t serial_server_init(void);
void serial_server_start(void);
void serial_server_attach_logs(void);
void serial_server_stop(void);

#endif /* SERIAL_SERVER_H */
