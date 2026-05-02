# DQ-DSP — ESP32-S3 Firmware

USB Audio Class 1.0 → on-device DSP → dual I2S out for two PCM5102A
breakouts. Pairs with the [DQ-DSP web UI](https://github.com/agooddaytowork/dq-dsp-ui)
for live parameter control over the same USB cable (CDC-ACM).

> **DQ** stands for **Dương Quỳnh** — the author's daughter.

## Audio path

```
USB host  →  TinyUSB UAC ring buffer  →  ASRC (PI controller, ±1400 ppm)
          →  DSP pipeline (Core 1):
              input gain · phase · mute
              10-band Room EQ ×2 ch
              10-band Input PEQ ×2 ch
              2 × 4 routing matrix
              10-band Output PEQ ×4 ch
              crossover (HP + LP, LR / Butterworth, 6/12/18/24 dB/oct)
              gain · delay (0–10 ms) · phase · mute
          →  Dual I2S TX  →  2 × PCM5102A  →  4 line outs
```

CDC-ACM on the same USB cable carries control frames (SLIP + CRC-8) for
the web UI's live parameter streaming, bulk Apply, and NVS Save-to-Device.

## Hardware

ESP32-S3-DevKitC + 2 × **GY-PCM5102 / TENSTAR ROBOT PCM5102A** breakouts.

| Function           | GPIO |
|--------------------|------|
| I2S0 BCK (DAC #1)  | 4    |
| I2S0 LRCK          | 5    |
| I2S0 DOUT          | 6    |
| I2S1 BCK (DAC #2)  | 16   |
| I2S1 LRCK          | 17   |
| I2S1 DOUT          | 18   |

Both DACs share 3V3 + GND. On each breakout:
- **XSMT** → 3V3 (un-mute — default jumper position is LOW = silence)
- **SCK** → GND (chip generates MCLK internally from BCK)
- FLT / DEMP / FMT → default LOW

Pin assignments are overridable via `idf.py menuconfig` →
*Audio DSP I2S Configuration (ESP32-S3)*.

## Build

ESP-IDF v5.x required. Set up per
<https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/>.

    . $IDF_PATH/export.sh
    idf.py set-target esp32s3
    idf.py build
    idf.py flash monitor

The included `./idf.sh` is a convenience wrapper.

`sdkconfig.defaults` pins the project-specific Kconfig values; the
generated `sdkconfig` is gitignored (user-local).

## Repository layout

    .
    ├── main/               # ESP-IDF component
    │   ├── main.c          # app_main: init NVS / DSP / I2S / USB
    │   ├── usb_audio.c     # TinyUSB UAC + CDC, ASRC PI controller
    │   ├── i2s_audio.c     # Dual I2S TX driver
    │   ├── serial_server.c # CDC frame parser → dsp_param_apply
    │   ├── Kconfig.projbuild
    │   └── CMakeLists.txt
    ├── shared/dsp/         # Pure-C DSP core
    │   ├── dsp_config.h
    │   ├── dsp_pipeline.c  # Biquad chain, routing matrix, crossover
    │   ├── dsp_param_update.c   # Atomic shadow-buffer swap
    │   ├── msg_handler.c   # Wire-protocol dispatch
    │   ├── serial_protocol.h    # Canonical frame layout (mirrored in UI repo)
    │   └── ble_protocol.h  # Header-compat constants (BLE transport removed at runtime)
    ├── CMakeLists.txt
    ├── partitions.csv
    ├── sdkconfig.defaults
    └── dependencies.lock

## Wire protocol

`shared/dsp/serial_protocol.h` is the canonical definition. Frame layout:

    0xAA 0x55 | length (1 byte) | payload | CRC-8 (poly 0x07)

The UI's TypeScript decoder lives at
[`src/types/serial-protocol.ts`](https://github.com/agooddaytowork/dq-dsp-ui/blob/main/src/types/serial-protocol.ts)
in the companion repo and is a one-to-one mirror.

## Web UI companion

UI lives at <https://github.com/agooddaytowork/dq-dsp-ui> — connect via
Web Serial on Chrome / Edge / Brave / Opera desktop. The UI auto-detects
unsupported browsers (Firefox, Safari, mobile) and shows a banner.

## License

[GPLv3](./LICENSE). ESP-IDF and its components are Apache 2.0; combined
binaries inherit GPL terms (one-way compatible). Forks and derivatives
of this firmware must remain open-source under the same license.

Copyright © 2026 Tam Duong (<https://tamduongs.com/>).
