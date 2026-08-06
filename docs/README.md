# DQ-DSP — Техническая документация

Единый репозиторий: **ESP32-S3 DSP-процессор** (2 входа / 4 выхода, USB Audio Class 1.0)
с **веб-интерфейсом** для live-управления по Web Serial.

## Навигация

| Документ | О чём |
|---|---|
| [`firmware-architecture.md`](firmware-architecture.md) | Архитектура прошивки: потоки и ядра, double-buffer параметров, DSP-конвейер, ASRC, телеметрия, модули + mermaid-диаграммы. |
| [`wire-protocol.md`](wire-protocol.md) | Спецификация wire-протокола: serial-фреймы, типы сообщений, layout `dsp_config_t`, CRC-8/CRC-32, bulk-передача, msg_id/ACK/retry, hex-примеры. |
| [`dsp-algorithms.md`](dsp-algorithms.md) | Математика DSP: биквад DF-IIT, Audio EQ Cookbook, кроссоверы Butterworth/Linkwitz-Riley, ASRC, PI-компенсатор, soft-clip, диапазоны валидации. |
| [`api-reference.md`](api-reference.md) | API-справочник: публичные функции FW и UI с сигнатурами и константами. |
| [`ui-architecture.md`](ui-architecture.md) | Архитектура веб-UI: слои, Zustand-стор и слайсы, serial-middleware, useWebSerial, экспорт/импорт конфига, пресеты + диаграммы retry/RX/reconnect. |
| [`DOCUMENTATION.md`](DOCUMENTATION.md) | Полное руководство: архитектура (mermaid), установка, API с примерами, сценарии использования, troubleshooting и FAQ. Рекомендуется начать здесь. |
| [`build-and-flash.md`](build-and-flash.md) | Сборка, прошивка и проверки (ESP-IDF 6 / Vite): команды, окружение, порядок верификации. |
| [`audit-2026-08.md`](audit-2026-08.md) | Результаты комплексного аудита (2026-08): найденные проблемы, применённые фиксы, оставшиеся рекомендации. |

## Краткая карта репозитория

```
dq-dsp/
├── dq-dsp-firmware/            # ESP-IDF 6.0.2, target esp32s3
│   ├── main/                   # app_main, USB Audio, I2S, serial-сервер
│   ├── shared/dsp/             # Чистый C: конфиг, конвейер, engine параметров, router
│   ├── components/usb_device_uac/  # vendored TinyUSB UAC-компонент
│   └── sdkconfig.defaults      # проектные Kconfig
├── dq-dsp-ui/                  # Vite + React 19 + TypeScript + Zustand
│   ├── src/store/              # слайсы стора + persist
│   ├── src/serial/             # middleware живого diff-стриминга
│   ├── src/hooks/useWebSerial.ts  # Web Serial транспорт
│   ├── src/export/             # binary-encoder/decoder + checksum
│   └── src/types/              # зеркала протокола (ble-protocol, serial-protocol)
└── docs/                       # этот раздел
```

## Две физические линии

| Линия | Роль | Протокол |
|---|---|---|
| USB-Serial-JTAG (UART0) | прошивка + управление из UI | serial-фреймы `0xAA 0x55`, CRC-8 |
| Native USB-OTG | аудио (UAC 1.0, 24-бит / 48 кГц стерео) | USB Audio Class |

Два разных кабеля в два порта платы. Аудио и управление изолированы на уровне транспорта.

## Ключевые принципы

- **Lock-free конфиг**: `dsp_config_t` двойной буфер, переключение атомарным указателем — аудио-задача читает активный буфер без блокировок.
- **Единственный владелец commit**: `dsp_param_commit()` вызывается только из аудио-задачи между аудио-чанками (см. аудит H2).
- **Живой diff-стриминг**: каждое изменение в UI шлётся как отдельный параметрический апдейт; полный конфиг — только по явному «Apply».
- **Прозрачность протокола**: `ble_protocol.h` / `serial_protocol.h` (C) — канонические источники; TS-зеркала в `dq-dsp-ui/src/types/` обязаны быть в синхроне.
