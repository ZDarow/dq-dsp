# AGENTS.md — DQ-DSP

Этот файл загружается Kilo для всех сессий проекта.

## Архитектура

Монорепозиторий: прошивка ESP32-S3 + веб-UI.

```
dq-dsp/
├── dq-dsp-firmware/       # ESP-IDF 5.5.5, C
│   ├── main/               # app_main, USB Audio, I2S, serial-сервер
│   ├── shared/dsp/         # DSP-ядро: biquad, crossover, param-update, wire-протокол
│   ├── components/usb_device_uac/  # vendored TinyUSB UAC
│   ├── tests/              # host golden-тесты (gcc, без ESP-IDF)
│   ├── sdkconfig.defaults  # источник истины Kconfig
│   └── partitions.csv      # кастомная partition table
├── dq-dsp-ui/              # Vite 7 + React 19 + TypeScript 5.9 + Zustand
│   ├── src/
│   │   ├── store/          # Zustand-слайсы
│   │   ├── serial/         # serial-middleware (diff → фреймы)
│   │   ├── hooks/useWebSerial.ts
│   │   ├── export/         # binary-encoder/decoder + checksum
│   │   └── types/          # зеркало wire-протокола
│   └── tests/              # Vitest
└── docs/                   # архитектура, протокол, DSP, build-and-flash
```

## Ключевые решения и ограничения

- **ESP-IDF 5.5.5** установлен в `C:\Users\Mi\esp-idf-v5.5.5`.
- **ESP32-S3 N8R2**: 8 MB flash, **PSRAM отсутствует** (`CONFIG_SPIRAM` не установлен).
- **Два USB-кабеля**:
  - USB-Serial-JTAG (UART0) — прошивка + Web Serial управление.
  - Native USB-OTG — аудио (UAC 1.0, 24-bit / 48 kHz).
- **Аудио I2S**: I2S0 (GPIO 4/5/6 — левый), I2S1 (GPIO 16/17/18 — правый).
- **Управление**: Web Serial, 115200 8N1, фреймы `0xAA 0x55 | length | payload | CRC-8`.
- **Canonical wire-протокол**: `dq-dsp-firmware/shared/dsp/serial_protocol.h`. TS-зеркало в `dq-dsp-ui/src/types/serial-protocol.ts` — при любом изменении протокола обновляй оба.
- **Конфиг DSP**: lock-free двойной буфер `dsp_config_t`, атомарный swap между аудио-блоками. `dsp_param_commit()` вызывается только из аудио-задачи.
- **NVS**: сохранение только по явному «Save to Device», отложено, чтобы не блокировать аудио-задачу flash-erase.

## Распиновка

| Функция | GPIO |
|---------|------|
| I2S0 BCK | 4 |
| I2S0 LRCK | 5 |
| I2S0 DATA | 6 |
| I2S1 BCK | 16 |
| I2S1 LRCK | 17 |
| I2S1 DATA | 18 |
| USB D+ | 20 |
| USB D- | 19 |
| UART0 TX | 43 |
| UART0 RX | 44 |

## Команды

### Firmware (Windows)

```powershell
cd dq-dsp-firmware
.\idf.ps1 build
.\idf.ps1 flash -p COM14
.\idf.ps1 flash monitor -p COM14
.\idf.ps1 menuconfig
```

`idf.ps1` ищет `IDF_PATH` в стандартных путях, в том числе `C:\Espressif\frameworks\esp-idf-v5.5.5`.

### Firmware (Linux/macOS)

```bash
cd dq-dsp-firmware
idfx build
idfx -p COM14 flash
```

### Host-тесты DSP (gcc, без ESP-IDF)

```bash
cd dq-dsp-firmware/tests
make test-host
make test-host-clean
```

### UI

```bash
cd dq-dsp-ui
npm install
npm run dev       # Vite dev-server
npm run test      # Vitest
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run format:check  # Prettier check
```

### VSCode задачи

Заданы в `.vscode/tasks.json`: `firmware: build`, `firmware: flash (COM14)`, `firmware: monitor (COM14)`, `ui: dev`, `ui: build`, `ui: test`, `firmware: test-host`.

## Стиль и форматирование

- **C**: 4 пробела, snake_case, K&R-скобки, `PointerAlignment: Right`. См. `.clang-format`. Форматируй через `clang-format` перед коммитом.
- **TypeScript/React**: 2 пробела, camelCase, без точек с запятой, `singleQuote`, `trailingComma: all`. См. `.prettierrc.json`.
- **Отступы/переводы**: `.editorconfig` — LF везде, кроме `.bat`/`.ps1` (CRLF).
- **Имена файлов**: kebab-case для C, PascalCase для React-компонентов, camelCase для утилит.
- **Комментарии**: на русском, описывают «почему», а не «что».

## Git

- Ветки: `feature/...`, `fix/...`, `refactor/...`, `docs/...` (английский, kebab-case).
- Базовая ветка: `main`.
- Коммиты: на русском, в повелительном наклонении, Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Атомарность: один коммит = одно логическое изменение, до ~400 строк.
- Перед коммитом: `npm run lint && npm run test && npm run build && npm run format:check` (UI) и `make test-host` (firmware).
- `git push` — только с явного разрешения.

## Безопасность

- Никогда не коммить `.env`, `*.pem`, `*.key`, секреты.
- `sdkconfig` gitignored; пользовательские Kconfig-оверрайды — через `idf.py menuconfig` или `SDKCONFIG_DEFAULTS`.
- `git push` — только с явного разрешения.

## Важные артефакты и gitignore

- `build/`, `*.bin`, `sdkconfig`, `managed_components/`, `.espressif/`, `node_modules/`, `coverage/`, `.env*`, `*.log`, `Screenshot_*.png`, `web-ui-*.png`.
- `dependencies.lock` (ESP-IDF component manager) — в gitignore, не коммить.

## Документация

- Полное руководство: `docs/DOCUMENTATION.md`.
- Архитектура прошивки: `docs/firmware-architecture.md`.
- Wire-протокол: `docs/wire-protocol.md`.
- DSP-алгоритмы: `docs/dsp-algorithms.md`.
- Build-and-flash: `docs/build-and-flash.md`.
- Аудит: `docs/audit-2026-08.md`.
- План задач: `docs/TASKS.md`.
