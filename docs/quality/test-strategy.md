---
type: Test Strategy
title: Стратегия тестирования v0.1
description: Набор автоматических и ручных проверок аудита, policy engine, MCP App и карантина.
tags: [quality, testing, safety, recovery]
status: approved
owner: Architect
date: 2026-07-15
---

# Цель

Тесты должны доказывать не только обнаружение остатков, но и невозможность действия при недостаточных или изменившихся доказательствах. Destructive-flow тестируется на синтетических данных и временных каталогах; реальные пользовательские пути не используются в CI.

# Уровни

## Parser fixtures

Версионированные fixtures покрывают приложения, receipts, JSON/YAML/plist, процессы, открытые файлы, APFS metadata и ошибки разрешений. Обязательны повреждённые, необычно большие, Unicode- и escape-насыщенные входы. Raw secret-like values присутствуют только во входном temp fixture и должны отсутствовать в observation, snapshot, логе и test output.

Полевой synthetic pack покрывает Application Support, Containers, Group Containers, HTTPStorages, WebKit, Preferences, Saved Application State, updater, browser profile, messenger/mail data, game save, database, Git project, settings, VPN subscription, системный launch item/helper и TCC denial. Названия, bundle IDs, paths и содержимое не копируют реальный Mac.

## Golden tests классификатора

Для каждого named rule хранится входной `EvidenceSet` и полный ожидаемый `Classification`. Изменение golden output требует review причины и версии правила.

## Policy tests

Матрица проверяет разделение `label` и `allowedActions`: `orphaned` с контрдоказательством, открытым файлом, risk-категорией или coverage gap не получает `prepare_move`. Отдельно проверяются name-only, protected owner, `~/APPS`, `~/.codex`, `.git`, sensitive metadata и active-app cache.

## Property-based и fuzz tests путей

Генераторы покрывают `..`, симлинки, hardlinks, mount boundaries, Unicode normalization, control characters, длинные пути, смену регистра и имена, похожие на shell options. Инвариант: результат либо остаётся внутри разрешённой границы, либо блокируется без изменения данных.

## Contract tests MCP

Проверяются точные input/output schemas, запрет неизвестных полей, annotations, `openWorldHint=false`, разделение model-visible и app-visible tools, `audit_cancel`, `supportLevel`, `ProtectedScopeRule`, `SafeMetadata`, `StorageSummary`, `DiskObservation`, отсутствие полных путей и secret-like values в `content` и `structuredContent`.

## Temp-directory E2E

Синтетический Library root проходит полный сценарий: audit → inspect → prepare → confirm → move → list → restore, а отдельно move → purge. Проверяются права, manifests, журнал, metadata и xattrs.

## Fault injection

Процесс принудительно останавливается до записи manifest, после `prepared`, сразу после rename и до финальной записи журнала. Следующий запуск обязан восстановить однозначное состояние либо заблокировать mutation-контур.

## Race tests

Между preview и действием меняются inode, содержимое, owner, тип объекта, исходный родитель, link boundary, mount ID и active/open-file status. Каждое изменение должно приводить к typed blocking error.

Отдельная матрица покрывает гонку `audit_cancel` с `completed`, `completed_with_warnings` и `failed`. В каждом запуске фиксируется ровно один terminal state; повторная отмена не запускает нового действия. Перед mutation также подменяются owner identity, protected-scope match и sensitivity flags; каждый случай завершается fail closed.

## UI tests

Проверяются три вкладки, состояния загрузки и отмены, coverage warnings, `supportLevel`, фильтры, evidence `Sheet`, «Оставить», Quarantine Center, пустые состояния, пять показателей, отсутствие кнопки при запрете policy, точный текст `AlertDialog`, одно действие за подтверждение, keyboard navigation, focus return и корректная обработка expired token. Отдельные negative tests доказывают отсутствие bulk action, shell-команд, tool call при «Оставить» и невозможность обойти policy прямым tool call.

## Real-Mac smoke

На Apple Silicon с macOS 26 вручную проверяются:

* запуск установленного release artifact;
* аудит с Full Disk Access и без него;
* quarantine/restore синтетического приложения;
* сохранение xattrs и metadata;
* Finder reveal;
* crash recovery;
* `audit → cancel` с просматриваемым, но недейственным partial report;
* Quarantine Center, restore, purge и обновление StorageSummary/DiskObservation;
* логический/физический размер, quarantine/purge и timestamped состояние диска без claim о причинном APFS delta;
* `~/APPS` и `~/.codex` недоступны для mutation;
* clean-room запуск в новой задаче Codex без копирования команд;
* отсутствие сетевых запросов во время основного сценария.

# Тестовые данные

Fixtures и E2E используют только синтетические bundle IDs, имена и содержимое. Репозиторий, snapshots, test output, CI и PR artifacts не должны содержать реальные домашние пути, список приложений пользователя, секреты, subscription URLs или снимки личной системы.

# Нефункциональные проверки

* audit status остаётся отзывчивым на большой синтетической выборке;
* память ограничена streaming-обработкой NDJSON, а не загрузкой всех findings;
* отмена read-only аудита не оставляет mutation state;
* автономный UI bundle работает без CDN и сети;
* package и release artifact проходят dependency, license и provenance checks.

# Связанные концепты

* [Модель угроз](../safety/threat-model.md)
* [Критерии приёмки](acceptance-gates.md)
