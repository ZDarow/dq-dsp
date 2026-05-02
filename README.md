# DQ-DSP — ESP32-S3 Firmware

### 👉 [**Try the live UI: dq-dsp.tamduongs.com**](https://dq-dsp.tamduongs.com)  ·  📦 [**Pre-built binaries (v1.0.0)**](https://github.com/agooddaytowork/dq-dsp-firmware/releases/tag/v1.0.0)  ·  🖥 [**UI source**](https://github.com/agooddaytowork/dq-dsp-ui)

USB Audio Class 1.0 → on-device DSP → dual I2S out for two PCM5102A
breakouts. Pairs with the **DQ-DSP web UI** for live parameter control
over a second USB cable (UART0 over the DevKitC-1's USB-Serial-JTAG port).

> *(DQ = my daughter's name. Yes, I named a DSP after her. Don't @ me.)*

[![DQ-DSP UI](docs/images/dq-dsp-ui.png)](https://dq-dsp.tamduongs.com)

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

Control frames (SLIP + CRC-8) for the web UI's live parameter streaming,
bulk Apply, and NVS Save-to-Device travel over **UART0** — exposed on the
DevKitC-1's **USB-Serial-JTAG** port (the same one you flash from). Audio
and control are on **two separate USB-C cables** plugged into the two
ports of the dev-board:

| DevKitC-1 port           | Used for                               | Cable |
|--------------------------|----------------------------------------|-------|
| USB-Serial-JTAG (UART0)  | flashing + Web Serial parameter control| #1    |
| Native USB-OTG           | USB Audio Class (UAC) — the actual audio stream | #2 |

## What do I actually do with this?

Plug an ESP32-S3 dev-board with two PCM5102A breakouts soldered in into
your laptop. Your OS sees a generic USB audio device showing up as
**usb uac** in the audio picker (that's the UAC interface descriptor
the upstream TinyUSB component ships — feel free to rename it to
*DQ-DSP* in your OS sound settings if you want). Open the web UI in
Chrome on the same laptop, click **Connect Serial**, and now every PEQ
knob you drag goes straight into the chip — no recompile, no MIDI, no
$400 miniDSP.

![How DQ-DSP plugs into your system](docs/images/usage-diagram.svg)

### The use case I actually built it for: active 2-way speakers

Bookshelf speakers are usually passive — the crossover is a chunk of
inductors and capacitors inside the cab, splitting one full-range
amplifier feed into woofer + tweeter. That passive XO has tradeoffs:
phase shift, insertion loss, no per-driver EQ, no time alignment.

**Active bi-amp** rips the passive crossover out and feeds each driver
its own amplifier, with the crossover done in DSP. DQ-DSP makes that a
$20 BOM:

| DSP output | Drives           | Typical settings                  |
|------------|------------------|-----------------------------------|
| Out 1      | Left woofer      | LP @ XO freq, LR4 24 dB/oct       |
| Out 2      | Left tweeter     | HP @ XO freq, LR4 24 dB/oct, +delay if needed |
| Out 3      | Right tweeter    | mirror of Out 2 (link group)      |
| Out 4      | Right woofer     | mirror of Out 1 (link group)      |

You pick the crossover frequency from the driver's spec sheet (usually
1.5–3 kHz for a typical 1" dome / 5" mid). Add per-driver gain trim,
delay for time-alignment, and PEQ for any baffle / room peaks. Save the
preset, commit to flash, unplug from the laptop — the box keeps playing
forever from any USB host.

## Bill of materials

| # | Part | Qty | Notes |
|---|------|-----|-------|
| 1 | **ESP32-S3-DevKitC-1 N16R8** | 1 | 16 MB flash + 8 MB Octal PSRAM. Standard 38-pin Espressif dev-board (also sold by Waveshare, AliExpress clones, etc.). |
| 2 | **GY-PCM5102 / TENSTAR ROBOT PCM5102A** breakout | 2 | Purple board with 3.5 mm jack on the long edge and L/R/G analog pads. ~$2 each on AliExpress. |
| 3 | USB-C data cable | 2 | DevKitC-1 has two USB-C ports — **USB-Serial-JTAG** (UART0, used for flashing AND web-UI control) and **native USB-OTG** (used for UAC audio). Both stay plugged in during normal use. *Both must be data-capable, not power-only.* |
| 4 | Dupont jumper wires (M-F) | ≥ 12 | 3 I2S signals × 2 DACs + shared 3V3 + GND = 8 minimum, plus a couple spares for the jumper pads. |
| 5 | 3.5 mm audio cable / pigtail | 2 | One per DAC, into your amp or powered speakers. |

Total parts cost: roughly **US $15–20** at the time of writing. ESP-IDF
v5.2 toolchain is the only software dependency.

## Wiring

![Wiring diagram — ESP32-S3 → 2× PCM5102A](docs/images/pin-diagram.svg)

| Function           | ESP32-S3 GPIO |
|--------------------|---------------|
| I2S0 BCK (DAC #1)  | 4             |
| I2S0 LRCK          | 5             |
| I2S0 DOUT          | 6             |
| I2S1 BCK (DAC #2)  | 16            |
| I2S1 LRCK          | 17            |
| I2S1 DOUT          | 18            |

Both DACs share **3V3** + **GND**. On each PCM5102A breakout:
- **XSMT** → 3V3 (un-mute — default jumper position is LOW = silence)
- **SCK** → GND (chip generates MCLK internally from BCK)
- FLT / DEMP / FMT → default LOW

Pin assignments are overridable via `idf.py menuconfig` →
*Audio DSP I2S Configuration (ESP32-S3)*.

## Flash a pre-built binary

Grab the merged image from the
[v1.0.0 release](https://github.com/agooddaytowork/dq-dsp-firmware/releases/tag/v1.0.0)
(the ``dq-dsp-firmware-1.0.0.bin`` asset — single file, flashed at offset
``0x0``).

### 1. Install esptool

    pip install esptool                # any Python 3.8+ env

### 2. Find the serial port

The DevKitC-1 has two USB-C connectors. Either one works for flashing —
the chip's ROM exposes a USB-Serial-JTAG / CDC interface in download
mode regardless of which port you plug in. Connect at least one cable
and look for a new device:

| OS         | Command                                                |
|------------|--------------------------------------------------------|
| **macOS**  | ``ls /dev/cu.usbmodem*`` — pick the new entry          |
| **Linux**  | ``ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null`` (or watch ``dmesg | tail`` after plug-in) |
| **Windows**| Device Manager → *Ports (COM & LPT)* → look for **USB Serial Device (COMxx)** |

> 💡 If two ports show up, either is fine for flashing — pick whichever
> is new. The other one will host the audio stream once the firmware is
> running.

### 3. Quit anything that's holding the port

If the chip is already running an earlier build of the firmware:

- macOS Sound Settings: switch the audio output **away** from "usb uac"
  (or whatever you renamed it to)
- Web UI: if you're connected, click **Disconnect**
- Other terminal apps (Arduino IDE serial monitor, ``screen``,
  ``picocom``) — close them

If ``esptool`` complains **"Resource busy"**, this is why.

### 4. Flash

    python -m esptool --chip esp32s3 \
      --port /dev/cu.usbmodemXXXX \
      -b 460800 \
      --before default_reset --after hard_reset \
      write_flash 0x0 dq-dsp-firmware-1.0.0.bin

Replace ``/dev/cu.usbmodemXXXX`` with whatever step 2 turned up
(on Linux it's ``/dev/ttyACM0``-ish, on Windows ``COM5`` or similar).
You should see ``Hash of data verified.`` followed by ``Hard resetting
via RTS pin...``.

After reset the chip enumerates as **usb uac** in your OS audio picker
(rename it to *DQ-DSP* in your sound settings — macOS, Windows, and
Linux all let you do this; the rename sticks per host).
[Open the UI](https://dq-dsp.tamduongs.com) in Chrome, click
**Connect Serial**, pick the device's `usbmodem*` port, and start tweaking.

## Build from source

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

UI source: <https://github.com/agooddaytowork/dq-dsp-ui>. Live deploy:
<https://dq-dsp.tamduongs.com>. Connect via Web Serial on Chrome / Edge /
Brave / Opera desktop — the UI auto-detects unsupported browsers
(Firefox, Safari, mobile) and shows a banner.

## Support the project

If DQ-DSP is useful to you and you want to chip in for hardware
prototypes, parts, or coffee while the next firmware version cooks,
buy me a Ko-fi:

[![ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/tamdnq)

Anything is appreciated and goes straight into the build.

## License

[GPLv3](./LICENSE). ESP-IDF and its components are Apache 2.0; combined
binaries inherit GPL terms (one-way compatible). Forks and derivatives
of this firmware must remain open-source under the same license.

Copyright © 2026 Tam Duong (<https://tamduongs.com/>).
