/*
 * USB string-descriptor override.
 *
 * The upstream `usb_device_uac` managed component bakes
 * CONFIG_UAC_TUSB_SERIAL_NUM (default "12345678") into the device
 * descriptor at compile time. macOS keys its CoreAudio "device renamed
 * to..." cache by USB vendor:product:serial — so every DQ-DSP board
 * shares one identity, which means a previous user's "rename to USB
 * UAC" persists across freshly-flashed devices.
 *
 * Fix: derive the serial at runtime from the chip's MAC. We can't
 * `__attribute__((weak))` over the managed component's
 * `tud_descriptor_string_cb`, but linker --wrap (set in CMakeLists.txt)
 * routes calls here, and we delegate to `__real_…` for every index
 * except the serial slot (#3).
 */

#include <stdint.h>
#include <string.h>

#include "esp_mac.h"
#include "tusb.h"

extern uint16_t const *__real_tud_descriptor_string_cb(uint8_t index, uint16_t langid);

/* Static buffer survives the duration of the IN transfer because TinyUSB
 * is single-threaded for control transfers. 1 header + 12 chars = 13. */
static uint16_t s_serial_desc[14];

uint16_t const *__wrap_tud_descriptor_string_cb(uint8_t index, uint16_t langid)
{
    if (index != 3) {
        return __real_tud_descriptor_string_cb(index, langid);
    }

    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);

    static const char hex_chars[] = "0123456789ABCDEF";
    char hex[12];
    for (int i = 0; i < 6; i++) {
        hex[i * 2]     = hex_chars[(mac[i] >> 4) & 0xF];
        hex[i * 2 + 1] = hex_chars[mac[i] & 0xF];
    }

    const uint8_t chr_count = 12;
    s_serial_desc[0] = (uint16_t)((TUSB_DESC_STRING << 8) | (2 * chr_count + 2));
    for (uint8_t i = 0; i < chr_count; i++) {
        s_serial_desc[1 + i] = (uint16_t)hex[i];
    }
    return s_serial_desc;
}
