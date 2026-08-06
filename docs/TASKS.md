# План устранения проблем (Tasks)

Сводный список задач по устранению найденных проблем. Источники: глубокий аудит
(гонки/архитектура, R1–R10) и `audit-2026-08.md` (H3, H4, M4, M6). Обновляйте
статусы по мере работы.

## High

| # | Задача | Локация |
|---|---|---|
| R1 | Устранить гонку staging-буфера — seqlock/атомарная копия в `dsp_param_commit` | `dq-dsp-firmware/shared/dsp/dsp_param_update.c:522` |
| R2 | Bulk gate — единая очередь для `sendBulkConfig`, без interleave с live-параметрами | `dq-dsp-ui/src/hooks/useWebSerial.ts:549-592`, `dq-dsp-ui/src/serial/serial-middleware.ts:213-252` |
| H4 | Retry-машина — единый таймер с декрементом попыток, ретрай на ошибку `write` | `dq-dsp-ui/src/hooks/useWebSerial.ts:114-135` |
| H3 | Bulk-континуация — при активном `bulkRxBufferRef` не разбирать сигнатуры ACK/ERROR/BULK | `dq-dsp-ui/src/hooks/useWebSerial.ts:163-295` |

## Medium

| # | Задача | Локация |
|---|---|---|
| R3 | `msg_id` — пропуск занятых id при переполнении 8 бит + пересчёт CRC | `dq-dsp-ui/src/hooks/useWebSerial.ts:110-138` |
| R4/M7 | Torn-read снапшота телеметрии — атомарное/защищённое копирование | `dq-dsp-firmware/shared/dsp/msg_handler.c:52-66` |
| M4 | Таймаут незавершённого bulk-приёма в FW | `dq-dsp-firmware/shared/dsp/msg_handler.c:150-178` |
| R5 | `auto_clear = false` согласно комментарию (провалы звука тишиной) | `dq-dsp-firmware/main/i2s_audio.c:39,66` |
| R6 | Асинхронный редирект `ESP_LOG`; убрать `ESP_LOGV` из hot-path | `dq-dsp-firmware/main/serial_server.c:127-145`, `dq-dsp-firmware/shared/dsp/dsp_param_update.c:538` |
| R7 | Полный `resetAll()` — сброс `roomEqBands`, `inputsLinked`, `outputLinkGroups` | `dq-dsp-ui/src/store/slices/preset-slice.ts:139-151` |
| M6 | OOB-проверки `bChannelNumber`/`alt` в vendored UAC | `dq-dsp-firmware/components/usb_device_uac/usb_device_uac.c:210,246,255,345,359` |
| G1 | Golden-тесты C↔TS: биквады, кросоверы, checksum-векторы | `dq-dsp-ui/src/dsp/`, `dq-dsp-ui/src/export/` |

## Low

| # | Задача | Локация |
|---|---|---|
| R8 | Единый PING-обработчик (дубли) | `dq-dsp-firmware/main/serial_server.c:213`, `dq-dsp-firmware/shared/dsp/msg_handler.c:155-160` |
| R9 | Синхронизировать дефолты PI-дрейфа UI (0.5/200 ppm) с FW | `dq-dsp-ui/src/store/slices/drift-slice.ts:16-21`, `dq-dsp-firmware/main/main.c:152-155` |
| R10 | DIP — инъекция `save_config_to_nvs` в `msg_transport_t` вместо `extern` | `dq-dsp-firmware/shared/dsp/msg_handler.c:18` |
| T1 | Декомпозиция god-modules: `dsp_param_update.c`, `useWebSerial.ts`, `usb_audio.c` | — |
| T2 | Кодоген `types/esp32.ts` из `dsp_config.h` (единый source of truth layout) | `dq-dsp-ui/src/types/esp32.ts` |
| T3 | Единый source of truth RoomEQ; унификация модели link-групп (`inputsLinked` vs `outputLinkGroups`) | `dq-dsp-ui/src/store/slices/room-eq-slice.ts`, `dq-dsp-ui/src/store/slices/link-slice.ts` |
| T4 | Тесты: `binary-decoder` round-trip, `checksum.ts`, retry-логика `useWebSerial` (fake timers), слайсы (diff/link/`applyDeviceConfig`) | `dq-dsp-ui/src/` |

## Порядок работ

1. **High** — все четыре (serial-стек UI + FW), начинать с R2 → H3 → H4 → R1.
2. **Medium** — R5/R6/R7 (FW-стабильность), затем R3/R4/M4, M6, G1.
3. **Low** — R8–R10, затем тесты T4 и рефакторинг T1–T3.

После каждого блока — сборка (`idf.py build`), линт и тесты
(`npm run build && npx eslint . && npx vitest run`), при наличии железа — прошивка
и проверка в UI.
