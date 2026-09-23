name: Feature request
about: Предложить новую функциональность
title: ''
labels: enhancement
body:
  - type: textarea
    attributes:
      label: Проблема
      description: Какую задачу вы хотите решить?
    validations:
      required: true
  - type: textarea
    attributes:
      label: Решение
      description: Как вы хотите её решить?
    validations:
      required: false
  - type: textarea
    attributes:
      label: Альтернативы
      description: Другие варианты решения (по желанию)
    validations:
      required: false
