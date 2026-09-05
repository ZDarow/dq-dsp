# Сборка, прошивка и проверки

## 1. Окружения

| Компонент | Версия/требование |
|---|---|
| ESP-IDF | **5.5.5** (target `esp32s3`) |
| Python | 3.11+ (ESP-IDF 5.5 требует ≥ 3.8; используйте venv из инсталлятора) |
| Node | см. `dq-dsp-ui/package.json` (`engines`) |
| npm | в паре с Node |
| gcc + make | для host golden-тестов прошивки (`make -C tests test-host`) |

ESP-IDF 5.5.5 официально поддерживает **Windows 10/11 (x64)**, **Linux (x64, aarch64)**,
**macOS (x64, aarch64/Apple Silicon)**. Все команды ниже приведены для каждой ОС.

## 2. Сборка и прошивка

### 2.1 Экспорт окружения ESP-IDF

Удобнее всего задать `IDF_PATH` и использовать обёртки, поставляемые с проектом.

**Windows (PowerShell):**
```powershell
$env:IDF_PATH = "C:\esp\esp-idf"  # или ваш путь
.\dq-dsp-firmware\idf.ps1 build
```

**Linux / macOS (bash/zsh):**
```bash
export IDF_PATH="$HOME/esp/esp-idf"
./dq-dsp-firmware/idf.sh build
```

Скрипты `idf.sh` / `idf.ps1` автоматически подхватывают `IDF_PATH` из переменной
окружения или ищут его в типичных местах (`$HOME/esp/esp-idf`,
`$HOME/.espressif/esp-idf`, `C:\esp\esp-idf`).

### 2.2 Сборка

**Windows:**
```powershell
cd C:\path\to\dq-dsp\dq-dsp-firmware
.\idf.ps1 build
```

**Linux / macOS:**
```bash
cd /path/to/dq-dsp/dq-dsp-firmware
./idf.sh build
```

Успех: `Project build complete`. Ожидаемые инфо-сообщения (не ошибки):
- `CMake Warning ... component_validation.cmake:98` — tinyusb использует include
  freertos без явной REQUIRES-зависимости (внутренняя нота IDF/компонента);
- `NOTE: ... BT_NIMBLE_MESH_PROVISIONER / FATFS_*: 'default 0' is not a valid bool`
  — безвредные замечания Kconfig-парсера IDF 5.5;
- `bootloader 36% free`, `app ... 93% free` — занятость разделов.

### 2.3 Поиск COM/tty-порта

**Windows (PowerShell):**
```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

**Linux:**
```bash
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```

**macOS:**
```bash
ls /dev/cu.usbserial* /dev/cu.usbmodem* 2>/dev/null
```

Обычно устройство — `COM14` (Windows, CH343 USB-Serial-JTAG) или
`/dev/ttyUSB0` (Linux), `/dev/cu.usbserial-XXXX` (macOS). Если портов нет —
проверьте кабель (должен быть data-кабель) и драйвер CH343/CH340.

### 2.4 Прошивка

**Windows:**
```powershell
.\idf.ps1 flash -p COM14
```

**Linux / macOS:**
```bash
./idf.sh flash -p /dev/ttyUSB0
```

Или полная команда esptool:

**Windows:**
```powershell
python -m esptool --chip esp32s3 -b 460800 --before default-reset --after hard-reset `
  write-flash --flash-mode dio --flash-size 8MB --flash-freq 40m `
  0x0 build\bootloader\bootloader.bin `
  0x8000 build\partition_table\partition-table.bin `
  0x10000 build\esp32s3_audio_dsp.bin
```

**Linux / macOS:**
```bash
python -m esptool --chip esp32s3 -b 460800 --before default-reset --after hard-reset \
  write-flash --flash-mode dio --flash-size 8MB --flash-freq 40m \
  0x0 build/bootloader/bootloader.bin \
  0x8000 build/partition_table/partition-table.bin \
  0x10000 build/esp32s3_audio_dsp.bin
```

Признак успеха: `Hash of data verified.` для каждого образа и `Hard resetting via RTS pin...`.
Перед прошивкой закройте всё, что держит порт (терминалы, UI-подключение, аудио-плеер).

### 2.5 Мониторинг логов

**Windows:**
```powershell
.\idf.ps1 monitor -p COM14
```

**Linux / macOS:**
```bash
./idf.sh monitor -p /dev/ttyUSB0
```

## 3. UI (Vite + React)

Команды идентичны на всех ОС:

```bash
cd dq-dsp-ui
npm install
npm run dev          # dev-сервер
```

### Production-сборка и проверки

```bash
npm run build        # tsc -b && vite build → dist/
npx eslint .         # линт всего проекта (0 предупреждений — цель)
npx vitest run       # unit-тесты (64/64)
npm audit            # уязвимости (0 — после npm audit fix)
npm outdated         # устаревшие зависимости (анализ вручную)
```

Артефакт сборки: `dist/` (~492 кБ js / 147 кБ gzip) — статический SPA для любого хостинга.

## 4. Порядок полной верификации изменений

1. `cd dq-dsp-ui && npm run build && npx eslint . && npx vitest run`
2. `cd dq-dsp-firmware && ./idf.sh build` (Linux/macOS) или `.\idf.ps1 build` (Windows)
3. При наличии железа: прошивка → проверить в UI (Connect → правки
   параметров → Apply → Save to Device).

## 5. Частые команды

| Задача | Команда |
|---|---|
| Полная пересборка FW | `idf.py fullclean && idf.py build` |
| Сменить target | `idf.py set-target esp32s3` |
| Меню конфигурации | `idf.py menuconfig` (I2S GPIO, битрейт, частота — `Kconfig.projbuild`) |
| Обновить зависимости UI | `npm audit fix` (патчи) / `npm update` (в рамках semver) |
| Установить managed-компоненты | автоматически при сборке (`dependencies.lock`) |
| Host-тесты DSP (кросс-платформенные) | `cd dq-dsp-firmware/tests && make test-host` |

## 6. Версионирование

- Версия приложения берётся из git: `App "esp32s3_audio_dsp" version: <short-sha>`
  (логируемое в бинарник). UI показывает `package.json#version` + `git rev-parse --short HEAD`.
- `DSP_VERSION` в `dsp_config.h` — версия layout конфига; при несовпадении bulk-конфиг
  отклоняется (защита от рассинхрона протокола).
