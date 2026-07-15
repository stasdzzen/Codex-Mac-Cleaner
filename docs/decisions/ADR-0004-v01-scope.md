---
type: ADR
title: "ADR-0004: узкий scope v0.1"
description: Ограничение первого релиза остатками обычных macOS-приложений.
tags: [adr, scope, mvp, safety]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Очистка developer artifacts, системных настроек и пользовательских документов требует разных моделей владения, восстановления и риска. Объединение их в первый релиз делает safety contract непроверяемым.

# Решение

v0.1 работает только с остатками обычных macOS-приложений в allowlisted user Library roots. Developer cleanup, дубликаты личных файлов, внешние тома и изменение системных объектов исключены.

# Последствия

* Единственный audit profile первого релиза — `application_remnants`.
* `node_modules`, `.next`, DerivedData, симуляторы, Docker, Colima, package caches и Git worktrees не сканируются.
* Нет массового «Очистить всё» и фоновой автоматической очистки.
* Новый профиль получает отдельный threat model, policy rules и ADR.
