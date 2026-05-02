set(SHARED_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../shared/dsp)

idf_component_register(SRCS "main.c"
                            "usb_audio.c"
                            "serial_server.c"
                            "i2s_audio.c"
                            "${SHARED_DIR}/dsp_pipeline.c"
                            "${SHARED_DIR}/dsp_param_update.c"
                            "${SHARED_DIR}/msg_handler.c"
                    INCLUDE_DIRS "." "${SHARED_DIR}"
                    PRIV_REQUIRES driver nvs_flash esp_psram esp_timer)
