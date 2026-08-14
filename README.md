# DQ-DSP

Единый репозиторий проекта **DQ-DSP** — гибкого DSP-процессора 2-входа / 4-выхода на базе ESP32-S3 с USB Audio Class и живым serial-управлением.

## Структура

| Каталог | Назначение |
|---------|------------|
| [`dq-dsp-ui/`](dq-dsp-ui) | Веб-интерфейс (Vite + React + TypeScript). Стримит правки параметров (усиление, ЭК, кроссовер, маршрутизация) на устройство в реальном времени; bulk-применение пресетов и сохранение в NVS. |
| [`dq-dsp-firmware/`](dq-dsp-firmware) | Прошивка ESP32-S3 (ESP-IDF 6.0.2): USB UAC-класс, ASRC-компенсация дрейфа, DSP-конвейер, dual I2S → 2× PCM5102A, serial-сервер. |
| [`docs/`](docs) | Техническая документация: архитектура, wire-протокол, алгоритмы DSP, сборка и прошивка, аудит. |
| [`scripts/`](scripts) | Вспомогательные скрипты (генерация типов, кодогенерация). |

## Быстрый старт

- **UI:** `cd dq-dsp-ui && npm install && npm run dev`
- **Прошивка:** см. `dq-dsp-firmware/README.md` и `docs/build-and-flash.md` (требуется ESP-IDF 6.0.2)

## Техническая документация

Подробная документация — в каталоге [`docs/`](docs):

| Документ | Содержание |
|---|---|
| [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) | Полное руководство: архитектура, установка, API, сценарии использования, troubleshooting. |
| [`docs/firmware-architecture.md`](docs/firmware-architecture.md) | Архитектура прошивки: потоки, double-buffer, DSP-конвейер, ASRC, модули |
| [`docs/wire-protocol.md`](docs/wire-protocol.md) | Спецификация serial-протокола, layout конфига, CRC-8/CRC-32, bulk-передача |
| [`docs/ui-architecture.md`](docs/ui-architecture.md) | Архитектура UI: store, middleware, Web Serial, экспорт/импорт |
| [`docs/dsp-algorithms.md`](docs/dsp-algorithms.md) | Математика DSP: биквады, кроссоверы, ASRC, PI-компенсатор, soft-clip |
| [`docs/build-and-flash.md`](docs/build-and-flash.md) | Сборка, прошивка, команды верификации |
| [`docs/audit-2026-08.md`](docs/audit-2026-08.md) | Аудит: находки, применённые фиксы, оставшиеся рекомендации |
| [`docs/TASKS.md`](docs/TASKS.md) | План устранения проблем и статусы задач |

## Ключевые особенности

- **Аппаратная платформа:** ESP32-S3 DevKitC-1 N8R2 (8 MB flash, 2 MB embedded PSRAM, dual-core Xtensa LX7 @ 240 MHz)
- **Аудио вход:** USB Audio Class 1.0, 24-bit / 48 kHz stereo
- **Аудио выход:** 4 канала (2× стерео) через 2× PCM5102A на I2S0/I2S1
- **Управление:** Web Serial (Chrome/Edge/ Brave/Opera desktop), 115200 8N1, live-параметры + bulk-конфиг
- **PSRAM:** отключен в конфигурации (`CONFIG_SPIRAM` не установлен), используется внутренний RAM

## Лицензия

[GPLv3](./LICENSE). ESP-IDF и его компоненты — Apache 2.0; комбинированные бинарные файлы наследуют условия GPL.

Copyright © 2026 Tam Duong (<https://tamduongs.com/>).