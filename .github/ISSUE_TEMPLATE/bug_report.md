name: Bug report
about: Сообщить об ошибке
title: ''
labels: bug
body:
  - type: textarea
    attributes:
      label: Описание
      description: Что не работает
    validations:
      required: true
  - type: textarea
    attributes:
      label: Шаги для воспроизведения
      render: textarea
      description: По порядку шаги, которые приводят к ошибке
    validations:
      required: true
  - type: textarea
    attributes:
      label: Ожидаемое поведение
      description: Что должно происходить
    validations:
      required: true
  - type: textarea
    attributes:
      label: Версия прошивки/UI
      description: SHA из main или номер релиза
    validations:
      required: true
  - type: textarea
    attributes:
      label: Окружение
      description: ОС, toolchain, ESP32
  - type: textarea
    attributes:
      label: Дополнительно
