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

Полевой synthetic pack покрывает Application Support, Containers, Group Containers, HTTPStorages, WebKit, Preferences, Saved Application State, updater, browser profile, mail data, game save, database, Git project, settings, VPN subscription, protected container metadata, stale receipt, official uninstaller, login/background/launch item без executable, system helper и TCC denial. Названия, bundle IDs, signing identities, paths и содержимое не копируют реальный Mac.

## Golden tests классификатора

Для каждого named rule хранится входной `EvidenceSet` и полный ожидаемый `Classification`. Изменение golden output требует review причины и версии правила.

## Policy tests

Матрица проверяет разделение `label` и `allowedActions`: `orphaned` с контрдоказательством, открытым файлом, risk-категорией или coverage gap не получает `prepare_move`. Отдельно проверяются name-only, universal protected classes, `~/.codex`, current project root, plugin state, `.git`, sensitive metadata, active-app cache, official uninstaller и совпавший `UserExclusion`.

## Exclusion state и migrations

Тесты покрывают create/list/remove/reset, persistence после перезапуска, миграцию каждой поддержанной schema version, неизвестную/повреждённую схему, path-only false match, owner/type/signing/bundle-package/target mismatch, фильтрацию до дорогого анализа и запрет destructive token для excluded finding.

## Property-based и fuzz tests путей

Генераторы покрывают `..`, симлинки, hardlinks, mount boundaries, Unicode normalization, control characters, длинные пути, смену регистра и имена, похожие на shell options. Инвариант: результат либо остаётся внутри разрешённой границы, либо блокируется без изменения данных.

## Contract tests MCP

Проверяются точные input/output schemas, запрет неизвестных полей, annotations, `openWorldHint=false`, разделение model-visible и app-visible tools, `audit_cancel`, `supportLevel`, `ProtectedScopeRule`, `UserExclusion`, `ScheduleIntent`, `FindingFacts`, `ReclaimEstimate`, `SafeMetadata`, `StorageSummary`, `DiskObservation`, отсутствие полных путей и secret-like values в `content` и `structuredContent`.

## Temp-directory E2E

Синтетический Library root проходит полный сценарий: audit → inspect → prepare → confirm → move → list → restore, а отдельно move → purge. Проверяются права, manifests, журнал, metadata и xattrs.

## Fault injection

Процесс принудительно останавливается до записи manifest, после `prepared`, сразу после rename и до финальной записи журнала. Следующий запуск обязан восстановить однозначное состояние либо заблокировать mutation-контур.

## Race tests

Между preview и действием меняются inode, содержимое, owner, тип объекта, исходный родитель, link boundary, mount ID и active/open-file status. Каждое изменение должно приводить к typed blocking error.

Отдельная матрица покрывает гонку `audit_cancel` с `completed`, `completed_with_warnings` и `failed`. В каждом запуске фиксируется ровно один terminal state; повторная отмена не запускает нового действия. Перед mutation также подменяются owner identity, protected-scope match и sensitivity flags; каждый случай завершается fail closed.

## UI tests

Проверяются пять вкладок, состояния загрузки и отмены, coverage warnings, `supportLevel`, `FindingFacts`, `ReclaimEstimate`, evidence `Sheet`, «Удалить», «Исключить», «Пропустить сейчас», Quarantine Center, Exclusions, Schedule, пустые состояния, пять показателей, отсутствие кнопки при запрете policy, точный текст `AlertDialog`, одно действие за подтверждение, keyboard navigation, focus return и корректная обработка expired token. Отдельные negative tests доказывают отсутствие bulk action, shell-команд, tool call при «Пропустить сейчас», direct delete исходника и обхода policy прямым tool call.

Schedule tests покрывают отсутствие default opt-in, одну automation без дубликатов, update/pause/resume/delete, read-only prompt, применение exclusions, отсутствие mutation/`sudo`, raw RRULE и graceful fallback без capability. MCP App никогда не вызывает host-native tool напрямую.

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
* universal protected classes, `~/.codex`, current project root и synthetic Git project недоступны для mutation;
* exclusion переживает перезапуск, снимается через «Снова проверять» и не совпадает с заменённой identity;
* schedule flow создаёт либо обновляет одну native automation при capability или показывает disabled fallback;
* clean-room запуск в новой задаче Codex без копирования команд;
* отсутствие сетевых запросов во время основного сценария;
* package privacy scan не находит username, реальные home paths, персональный app inventory или developer decisions.

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
