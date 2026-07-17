---
type: ADR
title: "ADR-0010: protected scopes, inspection-only sources и наблюдаемые метрики диска"
description: Фиксация server-side исключений, безопасных метаданных, системных находок и непричинных APFS-метрик.
tags: [adr, safety, privacy, filesystem, metrics]
status: approved
owner: Architect
date: 2026-07-17
---

# Контекст

Полевой аудит реального Mac показал, что совпадение имени не отделяет остаток удалённого приложения от личных данных, shared-компонента или активной среды. Он также выявил области, которые владелец запрещает сканировать как кандидаты, конфигурации с секретами и системные объекты, которые полезно объяснить, но нельзя менять в v0.1.

Три метрики ADR-0009 недостаточны для честного ответа: логический размер находки отличается от физического, а изменение свободного места APFS нельзя причинно вывести из размера purged payload.

# Решение

1. Локальный сервер применяет неизменяемый `ProtectedScopeRule` до создания кандидата и перед каждой mutation. Первоначальное полевое решение включало private owner-specific scopes; их точные названия и пути удалены из публичного канона и не являются runtime-правилами. `~/.codex` и любой локальный Git-проект защищены server-side как универсальные классы. Forged запрос блокируется кодом `PROTECTED_SCOPE`.
2. `Finding` получает `supportLevel: candidate | analysis_only | unsupported_manual`. Системные и shared-источники могут давать только `unsupported_manual` с безопасным объяснением, без mutation actions, готовой shell-команды или sudo-рекомендации.
3. JSON/YAML/plist сводятся к `SafeMetadata` до persistence и MCP output. Сырые ключи/значения, секреты, subscription URLs, полный путь и stderr не попадают в model-visible output, логи, fixtures или PR evidence.
4. Classifier не классифицирует по одному имени. Owner identity, installed state, process/open-file state, receipts, dependencies, temporal evidence, data kind и sensitivity проверяются раздельно; personal/sensitive признаки блокируют mutation.
5. `StorageSummary` добавляет `candidateLogicalBytes`. Отдельный `DiskObservation` показывает `availableBytes`, `totalBytes`, `observedAt` и `source=statfs`. UI не вычисляет причинный free-space delta и не связывает его с purge.
6. «Оставить» — session-local UI no-op текущей ревизии. Он не вызывает tool, не меняет policy и не создаёт постоянное исключение.
7. Установка, аудит и решения v0.1 проходят внутри Codex без копирования shell-команд. Unsupported finding не содержит готовой команды.

# Последствия

* ADR-0010 расширяет ADR-0004, ADR-0006 и ADR-0009, не ослабляя их.
* Candidate scan остаётся ограниченным девятью roots пользовательской `Library`; targeted inspection системных источников не превращает их в mutation scope.
* Реальные bundle IDs, пути, список приложений и конфигурации владельца не переносятся в репозиторий. Тесты используют синтетические identities и данные.
* Developer cleanup, `/Library` mutation, privileged operations и управление APFS/Time Machine остаются вне v0.1.
* Реализация распределяется по существующим CMC-03, CMC-04, CMC-05, CMC-07, CMC-08, CMC-09 и CMC-10; новая Issue не создаётся.

# Связанные концепты

* [Полевой safety-дизайн](../superpowers/specs/2026-07-17-field-research-safety-contract-design.md)
* [Узкий scope v0.1](ADR-0004-v01-scope.md)
* [Safety/UX-дополнения](ADR-0009-v01-safety-ux-completion.md)
* [Политика путей](../safety/path-policy.md)
* [Доменная модель](../contracts/domain-model.md)

# Статус после ADR-0011

Пункт 1 и пользовательский no-op из пункта 6 заменены [ADR-0011](ADR-0011-public-plugin-exclusions-scheduling.md). Privacy redaction private examples выполнена как исключение из правила неизменности истории: публичный документ сохраняет смысл решения, но не раскрывает решения и инвентарь владельца.
