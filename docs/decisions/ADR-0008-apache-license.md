---
type: ADR
title: "ADR-0008: Apache License 2.0"
description: Выбор лицензии проекта и обязательная замена исходного MIT LICENSE до начала реализации.
tags: [adr, license, apache-2.0]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Репозиторий создан с MIT License. Для проекта утверждена Apache License 2.0 с явным патентным грантом и стандартными правилами NOTICE и attribution.

# Решение

Лицензировать проект по Apache License 2.0. Текущий корневой `LICENSE` с текстом MIT считается временным несоответствием пустого репозитория и должен быть заменён до первого коммита с реализацией.

# Последствия

* Product- и implementation-планы обязаны включить замену корневого `LICENSE` официальным текстом Apache-2.0.
* При необходимости создаётся `NOTICE` с корректными attribution; пустой или формальный `NOTICE` не добавляется.
* Каждая новая зависимость проходит license compatibility check.
* Код или текст из Google knowledge-catalog не копируется автоматически; при переносе отдельно сохраняются требуемые notices.
* Release gate блокируется, если metadata пакета, `LICENSE` и опубликованный артефакт расходятся.

# Источники

1. [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)
2. [OSI: MIT License](https://opensource.org/license/mit)
