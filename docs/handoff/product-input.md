---
type: Product Handoff
title: Вход для Product-чата
description: Утверждённые архитектурные ограничения и ожидаемые результаты следующего этапа планирования.
tags: [handoff, product, planning, issues]
status: approved
owner: Architect
date: 2026-07-15
---

# Задача Product-чата

Сформировать PRD, документацию реализации, набор готовых к передаче промптов и GitHub Issues для Codex Mac Cleaner v0.1. Product-чат не переопределяет архитектуру и не начинает реализацию без отдельного запроса пользователя.

До запуска отдельного Product-чата эти артефакты поддерживает Архитектор. После запуска Product принимает их как исходное состояние, сверяет с каноном и продолжает без повторного открытия утверждённых решений.

# Продукт одним предложением

Публичный local-first Codex-плагин для macOS 26 на Apple Silicon, который безопасно находит остатки обычных приложений, объясняет доказательства и перемещает по одному подтверждённому объекту в обратимый карантин.

# Неизменяемые решения

1. Только macOS 26+, только `arm64`.
2. TypeScript/Node.js MCP-сервер и React/Vite MCP App; Swift отсутствует.
3. Единственный профиль v0.1 — `application_remnants`; developer cleanup исключён.
4. Full Disk Access необязателен; неполнота оформляется как coverage gaps.
5. Read-only аудит отделён от mutation-контура.
6. `allowedActions` вычисляет только серверный policy engine.
7. Модель и UI не передают произвольные пути в mutation-tools.
8. Карантин поэлементный, same-volume и атомарный; direct delete исходного объекта запрещён.
9. Restore работает только в исходный свободный путь; overwrite и alternate destination запрещены.
10. Purge только ручной, с отдельным preview одного payload; автоматического срока очистки нет.
11. Group Containers, базы данных, sync/VPN и personal files остаются analysis-only.
12. Локальная работа без сети и телеметрии; полный путь не виден модели.
13. UI — тёмный Audit Dashboard на shadcn/ui с semantic tokens.
14. Хранилище — JSON/NDJSON без базы данных.
15. Документация — OKF bundle, зафиксированный на Google knowledge-catalog commit `d44368c15e38e7c92481c5992e4f9b5b421a801d`.
16. Канал v0.1 — GitHub Releases и repository marketplace; публичная Plugin Directory отложена.
17. Лицензия — Apache-2.0; существующий MIT `LICENSE` нужно заменить до первого implementation commit.
18. Dashboard имеет пять вкладок; Quarantine Center даёт только поэлементные restore/purge.
19. `audit_cancel` кооперативно останавливает read-only аудит; partial report не разрешает mutation.
20. Сводка разделяет найденный, карантинный и окончательно удалённый объём без обещания точного свободного места APFS.
21. Built-in protected scopes используют только универсальные system/credential/browser-profile/personal/project/plugin/Codex classes; `~/.codex` и любой локальный Git-проект защищены, а персональные app/path rules отсутствуют.
22. JSON/YAML/plist преобразуются в `SafeMetadata`; raw keys/values, пароли, токены и subscription URLs не выходят в model output, логи, fixtures или PR evidence.
23. `Finding.supportLevel` равен `candidate`, `analysis_only` или `unsupported_manual`; системный/shared объект не получает mutation и готовую shell-команду.
24. Совпадение имени не является достаточным evidence; owner, installed state, process/open file, receipt, dependencies, temporal signal и data kind проверяются отдельно.
25. «Пропустить сейчас» — session-local no-op; «Удалить» означает подтверждённый quarantine одного объекта; «Исключить» создаёт identity-based local state.
26. `StorageSummary` разделяет logical/physical candidate bytes, quarantine и purge; `DiskObservation` показывает только timestamped состояние `statfs`.
27. Установка, аудит и решения v0.1 проходят внутри Codex без копирования shell-команд.
28. `UserExclusion` хранится вне репозитория и `~/.codex`, версионируется, пишется атомарно и не совпадает только по path.
29. Ежемесячный audit выключен по умолчанию и создаётся через capability-aware Codex automation bridge; cron и собственный LaunchAgent запрещены.
30. Публичный bundle, fixtures и evidence не содержат username, home paths, app inventory или персональные решения разработчика.

# Ожидаемые артефакты

Product-чат должен подготовить:

* PRD с problem statement, primary user journey, non-goals и измеримыми acceptance criteria;
* implementation plan с зависимостями и safe sequencing;
* copy-ready prompts для отдельных implementation-задач;
* GitHub Issues с одной проверяемой целью, границами, входами, outputs и gates;
* mapping «архитектурный концепт → PRD requirement → Issue → test/release gate»;
* отдельную первую задачу на Apache-2.0 license normalization;
* synthetic field fixtures и E2E без данных реального Mac;
* release checklist, который не объявляет manual smoke выполненным заранее.

# Рекомендуемая декомпозиция

1. Repository foundation: package layout, runtime guard, schemas, OKF validator и лицензия.
2. Read-only adapters и capability report.
3. Evidence normalization, classifier и golden fixtures.
4. Server-only policy engine и path policy.
5. Audit MCP tools и JSON/NDJSON store.
6. Quarantine transaction, journal и crash recovery.
7. Restore и отдельный purge flow.
8. MCP App resource, пяти-вкладочный Dashboard, Quarantine Center и app-only actions.
9. Persistent exclusions, migrations и вкладка управления.
10. Plugin manifest, Skill и repository marketplace packaging.
11. Capability-aware monthly schedule и honest fallback.
12. Security, privacy, fault-injection, clean-room и real-Mac release gates.

Публичные safety-уточнения распределяются внутри существующих пакетов CMC-03/04/05/07/08/09/10. Persistent exclusions и schedule получают отдельные CMC-12/13. Advanced Cleanup и Browser/Developer Storage фиксируются blocked research Issues CMC-14/15 и не входят в v0.1.

Зависимые задачи не должны идти параллельно до стабилизации контрактов. UI может использовать fixtures после фиксации schemas, но mutation-интеграция начинается только после policy и transaction tests.

# Обязательные ссылки в задачах

Каждая Issue с реализацией должна ссылаться минимум на:

* соответствующий документ из [архитектуры](../architecture/);
* соответствующий [контракт](../contracts/);
* применимую [политику безопасности](../safety/);
* конкретный [acceptance gate](../quality/acceptance-gates.md).

# Запрещённое расширение scope

Product-чат не добавляет bulk cleanup, автоматический purge, browser AI/cache cleanup, developer caches и management uv/npm/nvm/pnpm/node-gyp/Puppeteer/Whisper/Homebrew/Python/Docker/Colima/SDK, mutation в `/Library`, APFS/Time Machine management, cloud backend, analytics, privileged helper, Swift, SQLite, поддержку Intel или старых macOS. Такая потребность оформляется как отдельное предложение для Архитектора, а не как скрытая подзадача.

# Условия готовности Product-пакета

* между PRD, prompts и Issues нет противоречий с этим handoff;
* destructive work разбито на минимальные шаги с отдельными fail-closed tests;
* manual gates отмечены как будущие, а не выполненные;
* ни одна Issue не просит произвольный path input или обход policy;
* ни одна Issue не переносит реальные пути, bundle IDs, app inventory, конфигурации или секреты владельца в fixtures и evidence;
* clean-room/new-task gate доказывает no-terminal workflow, а manual real-Mac smoke остаётся открытым owner gate;
* out-of-scope идеи вынесены из v0.1 backlog;
* для каждого completion claim указан проверяемый output.

# Источники архитектурной истины

Начать чтение с [корневого индекса](../index.md), затем использовать [границы v0.1](../foundation/scope-and-principles.md), [компоненты](../architecture/components.md), [runtime flows](../architecture/runtime-flows.md), [MCP contract](../contracts/mcp-tools.md), [safety model](../safety/safety-model.md), [ADR-0011](../decisions/ADR-0011-public-plugin-exclusions-scheduling.md) и [acceptance gates](../quality/acceptance-gates.md).
