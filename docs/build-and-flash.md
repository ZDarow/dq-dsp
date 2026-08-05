# Сборка, прошивка и проверки

## 1. Окружения

| Компонент | Версия/требование |
|---|---|
| ESP-IDF | **6.0.2** (установлен в `C:\Users\Mi\Arduino\esp-idf-git\esp-idf`), target `esp32s3` |
| Python | 3.14 (в виртуальном окружении IDF) |
| Node | см. `dq-dsp-ui/package.json` (`engines`) |
| npm | в паре с Node |

## 2. Прошивка (Windows PowerShell)

### Экспорт окружения ESP-IDF

```powershell
& "C:\Users\Mi\Arduino\esp-idf-git\esp-idf\export.ps1" | Out-Null
```

### Сборка

```powershell
cd C:\Users\Mi\dq-dsp\dq-dsp-firmware
& "C:\Users\Mi\Arduino\esp-idf-git\esp-idf\export.ps1" | Out-Null
idf.py build
```

Успех: `Project build complete`. Ожидаемые инфо-сообщения (не ошибки):
- `CMake Warning ... component_validation.cmake:98` — tinyusb использует include
  freertos без явной REQUIRES-зависимости (внутренняя нота IDF/компонента);
- `NOTE: ... BT_NIMBLE_MESH_PROVISIONER / FATFS_*: 'default 0' is not a valid bool`
  — безвредные замечания Kconfig-парсера IDF 6;
- `bootloader 36% free`, `app ... 93% free` — занятость разделов.

### Поиск COM-порта

```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

Устройство — `COM10` (пример из последней прошивки). Если портов нет —
проверить, что плата подключена USB-кабелем с данными.

### Прошивка

```powershell
idf.py -p COM10 flash
```

или полная команда esptool:

```powershell
python -m esptool --chip esp32s3 -b 460800 --before default-reset --after hard-reset `
  write-flash --flash-mode dio --flash-size 16MB --flash-freq 80m `
  0x0 build\bootloader\bootloader.bin `
  0x8000 build\partition_table\partition-table.bin `
  0x10000 build\esp32s3_audio_dsp.bin
```

Признак успеха: `Hash of data verified.` для каждого образа и `Hard resetting via RTS pin...`.
Перед прошивкой закрыть всё, что держит порт (терминалы, UI-подключение, аудио-плеер).

### Мониторинг логов

```powershell
idf.py -p COM10 monitor
```

## 3. UI (Vite + React)

```powershell
cd C:\Users\Mi\dq-dsp\dq-dsp-ui
npm install
npm run dev          # dev-сервер
```

### Production-сборка и проверки

```powershell
npm run build        # tsc -b && vite build → dist/
npx eslint .         # линт всего проекта (0 предупреждений — цель)
npx vitest run       # unit-тесты (17/17)
npm audit            # уязвимости (0 — после npm audit fix)
npm outdated         # устаревшие зависимости (анализ вручную)
```

Артефакт сборки: `dist/` (~492 кБ js / 147 кБ gzip) — статический SPA для любого хостинга.

## 4. Порядок полной верификации изменений

1. `cd dq-dsp-ui && npm run build && npx eslint . && npx vitest run`
2. `cd dq-dsp-firmware && idf.py build`
3. При наличии железа: `idf.py -p COMxx flash` → проверить в UI (Connect → правки
   параметров → Apply → Save to Device).

## 5. Частые команды

| Задача | Команда |
|---|---|
| Полная пересборка FW | `idf.py fullclean && idf.py build` |
| Сменить target | `idf.py set-target esp32s3` |
| Меню конфигурации | `idf.py menuconfig` (I2S GPIO, битрейт, частота — `Kconfig.projbuild`) |
| Обновить зависимости UI | `npm audit fix` (патчи) / `npm update` (в рамках semver) |
| Установить managed-компоненты | автоматически при сборке (`dependencies.lock`) |

## 6. Версионирование

- Версия приложения берётся из git: `App "esp32s3_audio_dsp" version: <short-sha>`
  (логируемое в бинарник). UI показывает `package.json#version` + `git rev-parse --short HEAD`.
- `DSP_VERSION` в `dsp_config.h` — версия layout конфига; при несовпадении bulk-конфиг
  отклоняется (защита от рассинхрона протокола).
