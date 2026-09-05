# Contributing to DQ-DSP

Спасибо за интерес к проекту. Этот документ описывает правила, которые помогают
поддерживать кодовую базу в порядке.

## 1. Код-стайл

| Аспект | Правило |
|--------|---------|
| **C/прошивка** | 4 пробела, snake_case, K&R-style скобки. См. `.clang-format`. |
| **TypeScript/React** | 2 пробела, camelCase, без точек с запятой. См. `.editorconfig` + `.prettierrc.json`. |
| **Отступы/перевод строк** | См. `.editorconfig` (LF для всего, кроме `.bat`/`.ps1`). |
| **Имена файлов** | kebab-case для C (`dsp_pipeline.c`), PascalCase для React-компонентов, camelCase для утилит. |

## 2. Коммиты

- **Язык сообщений**: русский, повелительное наклонение.
- **Формат** (рекомендуется Conventional Commits):
  ```
  feat: краткое описание новой функциональности
  fix: краткое описание исправления
  docs: изменения в документации
  refactor: рефакторинг без изменения поведения
  test: добавление/изменение тестов
  chore: вспомогательные изменения (CI, .gitignore)
  ```
- **Атомарность**: один коммит = одно логическое изменение.
- **Размер**: до 400 строк в одном коммите (если больше — разбейте).

## 3. Ветки

- Формат: `feature/...`, `fix/...`, `refactor/...`, `docs/...` (kebab-case, английский).
- Базовая ветка: `main`.
- Перед PR: rebase на актуальный `main`, не merge.

## 4. Перед коммитом

Обязательно прогнать на месте:

```bash
# UI
cd dq-dsp-ui
npm run lint
npm run test
npm run build
npm run format:check

# Firmware (хост-тесты DSP)
cd dq-dsp-firmware/tests
make test-host
```

Все 4 проверки должны быть зелёными. CI прогоняет то же самое автоматически
на `windows-latest` (UI) и `ubuntu-latest` (firmware).

## 5. Pull Request

- Заголовок PR: то же, что первый коммит.
- Описание: что, почему, как протестировано. Скриншоты для UI-изменений.
- Не коммитьте артефакты сборки (`*.bin`, `*.elf`, `build/`, `dist/`, `managed_components/`).
  Они уже в `.gitignore` — если что-то пробралось, удалите через `git rm --cached`.

## 6. Структура директорий

```
dq-dsp/
├── dq-dsp-firmware/      ESP-IDF 5.5.5 прошивка (C)
│   ├── main/             Точка входа
│   ├── components/       Локальные ESP-IDF компоненты
│   ├── shared/dsp/       Переиспользуемые модули (wire-протокол, DSP)
│   └── tests/            Хост-тесты (gcc + make)
├── dq-dsp-ui/            Web UI (Vite + React 19 + TypeScript 5.9)
│   ├── src/components/   UI-блоки, сгруппированные по домену
│   ├── src/store/        Zustand-стор, slices
│   ├── src/hooks/        React-хуки
│   └── tests/            Vitest unit-тесты
├── docs/                 Техническая документация
└── scripts/              Утилиты разработки
```

## 7. Безопасность

- Никогда не коммитьте секреты (`.env`, `*.pem`, `*.key`).
- Используйте переменные окружения или `idf.py -D SDKCONFIG_DEFAULTS=...`.
- `git push` — только с явного разрешения Хозяина.

## 8. Лицензия

Все вклады наследуют GPLv3 (см. `LICENSE`).
