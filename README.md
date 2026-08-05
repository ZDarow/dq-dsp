# DQ-DSP

Единый репозиторий проекта **DQ-DSP** — гибкого DSP-процессора 2-входа / 4-выхода на базе ESP32-S3 с USB Audio Class и живым serial-управлением.

## Структура

| Каталог | Назначение |
|---------|------------|
| [`dq-dsp-ui/`](dq-dsp-ui) | Веб-интерфейс (Vite + React + TypeScript). Стримит правки параметров (усиление, ЭК, кроссовер, маршрутизация) на устройство в реальном времени; bulk-применение пресетов и сохранение в NVS. |
| [`dq-dsp-firmware/`](dq-dsp-firmware) | Прошивка ESP32-S3 (ESP-IDF): USB UAC-класс, ASRC-компенсация дрейфа, DSP-конвейер, dual I2S → 2× PCM5102A, serial-сервер. |

## Быстрый старт

- **UI:** `cd dq-dsp-ui && npm install && npm run dev`
- **Прошивка:** см. `dq-dsp-firmware/README.md` (требуется ESP-IDF)

## Техническая документация

Подробная документация — в каталоге [`docs/`](docs):

| Документ | Содержание |
|---|---|
| [`docs/firmware-architecture.md`](docs/firmware-architecture.md) | Архитектура прошивки: потоки, double-buffer, DSP-конвейер, ASRC, модули |
| [`docs/wire-protocol.md`](docs/wire-protocol.md) | Спецификация serial/BLE-протокола, layout конфига, CRC |
| [`docs/ui-architecture.md`](docs/ui-architecture.md) | Архитектура UI: store, middleware, Web Serial, экспорт/импорт |
| [`docs/build-and-flash.md`](docs/build-and-flash.md) | Сборка, прошивка, команды верификации |
| [`docs/audit-2026-08.md`](docs/audit-2026-08.md) | Аудит: находки, применённые фиксы, оставшиеся рекомендации |

## История

Оба проекта импортированы в единый репозиторий через `git subtree` с сохранением их исходной истории коммитов.