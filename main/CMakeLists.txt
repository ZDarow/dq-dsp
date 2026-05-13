set(SHARED_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../shared/dsp)

idf_component_register(SRCS "main.c"
                            "usb_audio.c"
                            "serial_server.c"
                            "i2s_audio.c"
                            "usb_descriptor_override.c"
                            "${SHARED_DIR}/dsp_pipeline.c"
                            "${SHARED_DIR}/dsp_param_update.c"
                            "${SHARED_DIR}/msg_handler.c"
                    INCLUDE_DIRS "." "${SHARED_DIR}"
                    PRIV_REQUIRES driver nvs_flash esp_psram esp_timer
                                  esp_hw_support
                                  usb_device_uac
                                  espressif__tinyusb)

# Route TinyUSB's compile-time-baked tud_descriptor_string_cb through our
# wrapper so we can substitute a per-chip MAC-derived serial instead of
# the upstream "12345678" default. The --undefined flag forces ld to
# pull the override object out of libmain.a before final symbol
# resolution; without it, lazy archive scanning misses the wrap target.
target_link_options(${COMPONENT_LIB} INTERFACE
                    "-Wl,--wrap=tud_descriptor_string_cb"
                    "-Wl,--undefined=__wrap_tud_descriptor_string_cb")
