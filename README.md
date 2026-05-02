# DQ-DSP — Web UI

### 👉 [**Check it out: dq-dsp.tamduongs.com**](https://dq-dsp.tamduongs.com)

Real-time control surface for **DQ-DSP** — an ESP32-S3 USB Audio Class
device with a 2-in / 4-out parametric pipeline. Parameter edits stream
to the device live over Web Serial; presets live in the browser's
localStorage and can be exported as JSON or committed to the device's
flash.

> *(DQ = my daughter's name. Yes, I named a DSP after her. Don't @ me.)*

![DQ-DSP UI screenshot](docs/images/sample.png)

## Features

- **2 inputs × 4 outputs**, 10-band parametric EQ on every channel
- **Room EQ** stage with REW measurement import + auto-EQ against
  flat / Harman / tilt targets
- **2 × 4 routing matrix** with per-crosspoint linear gain
- **Per-output**: gain · mute · phase · 0–10 ms delay · 10-band PEQ
  · crossover (LR / Butterworth, 6/12/18/24 dB/oct)
- **Flexible link groups** — any-to-any output mirroring
- **Live clock-drift compensation (ASRC)** with tunable PI controller
- Per-channel CPU-load + buffer-fill telemetry charts
- **Liquid Glass** UI in light + dark
- Full keyboard accessibility, theme-aware tooltips with REW export
  step-by-step instructions baked into the Import REW button

## Demo notes

Open <https://dq-dsp.tamduongs.com> in **Chrome / Edge / Brave / Opera
on desktop** to actually push parameters to a connected device. On
mobile, Firefox, or Safari you can still browse the UI — Web Serial
just isn't exposed there, and a banner says so.

No hardware? You can still drag PEQ bands, swap routing, load presets,
and watch the response chart redraw. Everything except the live device
push works offline.

## Run locally

    npm install
    npm run dev

Build for production:

    npm run build

The build is a static SPA in `dist/` — drop it on any static host.

## Deploying to Vercel

The UI is a stock Vite + React project. On Vercel: **New Project →
Import** the GitHub repo and accept the auto-detected defaults
(`npm install` / `npm run build` / `dist/`). The build script reads
`package.json#version` and `git rev-parse --short HEAD` at compile
time and surfaces them in the AppFooter, so each deploy shows the
exact commit it was built from.

## Hardware companion

Firmware lives at
[`agooddaytowork/dq-dsp-firmware`](https://github.com/agooddaytowork/dq-dsp-firmware).
The wire-protocol contract is documented there in
`shared/dsp/serial_protocol.h`. The TypeScript decoder in
`src/types/serial-protocol.ts` is a direct mirror.

## Support the project

If DQ-DSP is useful to you and you want to chip in for hardware
prototypes, parts, or coffee while the next firmware version cooks,
buy me a Ko-fi:

[![ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/tamdnq)

Anything is appreciated and goes straight into the build.

## License

[GPLv3](./LICENSE). Forks and derivatives must remain open-source under
the same terms.

Copyright © 2026 Tam Duong (<https://tamduongs.com/>).
