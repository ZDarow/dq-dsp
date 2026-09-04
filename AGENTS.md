# AGENTS.md — Правила для Kilo-агента

Этот файл загружается Kilo-агентом для всех сессий работы с проектом DQ-DSP.

## Архитектура проекта

DQ-DSP — это проект аудио-ЦОС на базе ESP32-S3:

```
dq-dsp/
├── dq-dsp-firmware/       # ESP-IDF 5.5.5 прошивка (C/ASM)
│   ├── main/                # Основной код (main.c, serial_server.c, dsp_pipeline.c)
│   ├── components/          # Компоненты (usb_device_uac/)
│   ├── shared/dsp/          # Общие DSP-алгоритмы (biquad, crossover)
│   ├── tests/               # Хост-тесты (gcc)
│   └── sdkconfig            # Конфигурация сборки
├── dq-dsp-ui/              # Web UI (React 19 + Vite 7 + TypeScript 5.9)
│   ├── src/                  # Исходный код
│   ├── tests/                # Vitest unit-тесты
│   └── package.json
├── docs/                   # Архитектурная документация
└── scripts/                # Утилиты (generate-esp32-types.js)
```

## Ключевые решения

- **ESP-IDF:** v5.5.5 (установлен в `C:\Users\Mi\esp-idf-v5.5.5`)
- **Микроконтроллер:** ESP32-S3 (N8R2 — 8МБ flash, без PSRAM)
- **Аудио вывод:** I2S0 (GPIO 4/5/6 — левый канал) + I2S1 (GPIO 16/17/18 — правый канал)
- **USB UAC:** Native USB-OTG (GPIO 19/20), TinyUSB, PID 0x8000
- **UART0 консоль:** GPIO 43/44 → CH343 на COM14, 115200 baud
- **Управление:** Web Serial API (браузер) через PING/PONG протокол

## Распиновка

| Функция | GPIO | Примечание |
|---------|------|------------|
| I2S0 BCK | GPIO 4 | Левый канал |
| I2S0 LRCK | GPIO 5 | Левый канал |
| I2S0 DATA | GPIO 6 | Левый канал |
| I2S1 BCK | GPIO 16 | Правый канал |
| I2S1 LRCK | GPIO 17 | Правый канал |
| I2S1 DATA | GPIO 18 | Правый канал |
| USB D+ | GPIO 20 | USB-OTG PHY |
| USB D- | GPIO 19 | USB-OTG PHY |
| UART0 TX | GPIO 43 | Консоль через COM14 |
| UART0 RX | GPIO 44 | Консоль через COM14 |

## Стандарты кодирования

- **Язык:** C (firmware), TypeScript/React (UI)
- **Отступы:** 4 пробела (C), 2 пробела (TypeScript)
- **Комментарии:** На русском языке (описывают «почему», а не «что»)
- **Имена переменных:** Английский (snake_case для C, camelCase для TS)

## Сборка и тестирование

```bash
# Прошивка
cd dq-dsp-firmware
idfx build
idfx -p COM14 flash

# UI
cd dq-dsp-ui
npm run dev       # локальная разработка
npm run test      # unit-тесты
npm run build     # продакшен сборка

# Хост-тесты прошивки
cd dq-dsp-firmware/tests
make test-host
```

## Git правила

- Ветки: `feature/...`, `fix/...`, `refactor/...` (английский, kebab-case)
- Коммиты: на русском языке, в повелательном наклонении
- Перед коммитом: проверить `npm run lint` и `npm run test`

## Безопасность

- Никогда не коммитить `.env`, `*.pem`, `*.key`, секреты
- Использовать переменные окружения для секретов
- `git push` только с явного разрешения пользователя
