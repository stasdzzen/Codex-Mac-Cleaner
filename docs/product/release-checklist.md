---
type: Release Checklist
title: Release checklist Codex Mac Cleaner v0.1
description: Последовательная проверка готовности без автоматического release или ложных ручных отметок.
tags: [product, release, checklist, evidence]
status: approved
owner: Architect
date: 2026-07-15
---

# Правило использования

Этот список описывает будущую проверку. На этапе планирования все пункты считаются невыполненными. Выпуск, tag и публикация требуют отдельной команды владельца.

# Канон и лицензия

* [ ] OKF validator проходит на release commit.
* [ ] PRD, Issues и код не противоречат safety-инвариантам.
* [ ] Корневой `LICENSE` содержит официальный Apache-2.0.
* [ ] Package и artifact metadata указывают Apache-2.0.
* [ ] License compatibility зависимостей проверена; `NOTICE` создан только при фактической необходимости.

# Сборка и платформа

* [ ] Clean checkout собирает MCP server и автономный widget фиксированными командами.
* [ ] Runtime guard отклоняет macOS ниже 26, Intel и Rosetta до аудита.
* [ ] Release artifact не содержит x86_64 payload, debug secrets или абсолютные пути сборочной машины.

# Safety и recovery

* [ ] Contract, golden, property-based, fuzz, race и fault-injection tests проходят на final head SHA.
* [ ] Mutation не принимает path или destination.
* [ ] Quarantine использует durable `prepared` manifest и same-volume atomic rename.
* [ ] Restore не перезаписывает объект и сохраняет проверяемые metadata/xattrs.
* [ ] Purge ручной, поэлементный и не следует ссылкам.
* [ ] Повреждённый manifest блокирует destructive-tools.
* [ ] `audit_cancel` и race tests дают один terminal state; в `cancelled` нет `allowedActions`.
* [ ] Failed purge не скрывает payload и не меняет `purgedPhysicalBytes`.

# Privacy и UI

* [ ] Model-visible ответы и обычные логи не содержат полных путей.
* [ ] Основной сценарий не выполняет сетевых запросов и не отправляет телеметрию.
* [ ] Dashboard работает без CDN и показывает coverage, риск и причины запрета не только цветом.
* [ ] Dashboard имеет вкладки «Обзор», «Находки», «Карантин» и не имеет bulk purge.
* [ ] Метрики приходят с сервера; `purgedPhysicalBytes` не назван точно освобождённым местом APFS.
* [ ] Tabs, dialogs и actions проходят keyboard/focus tests.
* [ ] App-only mutation tools недоступны модели.

# Распространение

* [ ] `.codex-plugin/plugin.json`, `.mcp.json` и `SKILL.md` проходят проверки.
* [ ] Clean-room установка из repository marketplace воспроизведена.
* [ ] SBOM, checksum и provenance связаны с tag и commit.
* [ ] Real-Mac smoke выполнен на macOS 26 Apple Silicon и приложен к тому же commit.
* [ ] Независимое review подтверждает specification compliance, code quality и evidence freshness.

# Ручные действия владельца

* [ ] Владелец отдельно разрешил release.
* [ ] Tag и GitHub Release созданы только после разрешения.
* [ ] Публичная Plugin Directory не заявлена и не используется в v0.1.
