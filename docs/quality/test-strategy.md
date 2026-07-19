---
type: Test Strategy
title: Стратегия тестирования v0.1
description: Набор автоматических и ручных проверок аудита, policy engine, MCP App и карантина.
tags: [quality, testing, safety, recovery]
status: approved
owner: Architect
date: 2026-07-19
---

# Цель

Тесты должны доказывать не только обнаружение остатков, но и невозможность действия при недостаточных или изменившихся доказательствах. Destructive-flow тестируется на синтетических данных и временных каталогах; реальные пользовательские пути не используются в CI.

# Уровни

## Parser fixtures

Версионированный deterministic builder покрывает приложения, receipts, JSON/YAML/plist, процессы, открытые файлы, dependencies, APFS metadata и ошибки разрешений. Raw synthetic paths, inventory, bundle/package/signing claims и secret-like values генерируются из фиксированного seed только во временной памяти/директории и должны отсутствовать в checked-in fixture, observation safe view, snapshot, логе, test output и PR evidence. Обязательны повреждённые, необычно большие, Unicode- и escape-насыщенные входы.

Полевой synthetic pack покрывает Application Support, Containers, Group Containers, HTTPStorages, WebKit, Preferences, Saved Application State, updater, browser profile, mail data, game save, database, Git project, settings, VPN subscription, protected container metadata, stale receipt, official uninstaller, login/background/launch item без executable, system helper и TCC denial. Названия, bundle IDs, signing identities, paths и содержимое не копируют реальный Mac.

## Golden tests классификатора

Для каждого named rule хранится входной `EvidenceSet` и полный ожидаемый `Classification`. Изменение golden output требует review причины и версии правила.

## Correlation resolver и coverage

Табличные тесты покрывают отдельные `library_artifact`/`owner_application` subjects, exact receipt payload, OS-owned container metadata, signed process/open-file historical binding, filesystem/bundle/package/signing/owner claims, shared signer, duplicate bundle/package ID, owner mismatch, replaced inode, missing claim и несколько совместимых целей. Path-only, basename, display-name, bundle-ID-only, name-only и user attestation никогда не создают authoritative `remnant_of` или mutation authority.

Для artifact existence, owner app/executable, process, open file, startup target, uninstaller, receipt lifecycle и dependency проверяются все combinations: positive match, complete empty query, stale receipt, permission denied, capability missing, partial/truncated inventory, parse loss, timeout, cancellation, ambiguous и mismatch. `absent` появляется только при валидном `CoverageCertificate` полного same-snapshot query; все остальные negative cases дают `unknown`.

Отдельная матрица requirement profiles проверяет `required | not_applicable | unsupported`: `not_applicable` не создаёт certificate, не заменяет query error и не подавляет positive evidence. Клиентская попытка выбрать profile/applicability отклоняется schema validation.

Snapshot A/B tests меняют candidate, parent, executable, process/open-file inventory, receipt и dependency между фазами. Любое изменение выставляет `staleDuringAudit`, меняет correlation revision и инвалидирует actions/handles.

## Policy tests

Матрица проверяет разделение `label` и `allowedActions`: `orphaned` с контрдоказательством, открытым файлом, risk-категорией, required `unknown`, `unsupported`, ambiguity/mismatch или coverage gap не получает `prepare_move`. Единственный GREEN case — приватный регенерируемый `cache | log` с `private_regenerable_remnant_v1`, authoritative owner binding, отсутствующим owner/executable, receipt `absent | stale`, полным required coverage и стабильным A/B. Application Support, Containers/Group Containers, Preferences, WebKit/HTTPStorages, Saved State, databases, sync/VPN/personal/autostart принудительно inspect-only. Отдельно проверяются name/path/display/bundle-only, universal protected classes, `~/.codex`, current project root, plugin state, `.git`, sensitive metadata, active-app cache, official uninstaller и совпавший `UserExclusion`.

## Exclusion state и migrations

Тесты покрывают create/list/remove/reset, persistence после перезапуска, installation-key/rekey, domain separation, dictionary-attack regression для low-entropy identities, миграцию каждой поддержанной schema version, неизвестную/повреждённую схему, missing key, migration-required, path/name-only false match, owner/type/signing/bundle-package/target mismatch, фильтрацию до дорогого анализа и запрет destructive token для excluded finding. Persisted store и test output не содержат plaintext claims.

## Property-based и fuzz tests путей

Генераторы покрывают `..`, симлинки, hardlinks, mount boundaries, Unicode normalization, control characters, длинные пути, смену регистра и имена, похожие на shell options. Инвариант: результат либо остаётся внутри разрешённой границы, либо блокируется без изменения данных.

## Contract tests MCP

Проверяются точные input/output schemas, запрет неизвестных полей, annotations, `openWorldHint=false`, разделение model-visible и app-visible tools, `audit_cancel`, `supportLevel`, `ProtectedScopeRule`, keyed `UserExclusion`, `ScheduleIntent`, `FindingFacts`, `SafeCorrelationView`, `ReclaimEstimate`, `SafeMetadata`, `StorageSummary`, `DiskObservation`, отсутствие полных путей, inventory, bundle/package/signing claims, graph/certificates, token material и secret-like values в `content`, `structuredContent` и `_meta`.

## Temp-directory E2E

Синтетический Library root проходит полный сценарий именно на production adapters: generated `~/Library/Caches` либо `~/Library/Logs` artifact → audit → authoritative owner binding → profile/coverage → inspect → prepare handle → confirm → move → list → restore, а отдельно move → purge. `.app` внутри candidate root не считается достаточным production proof. Проверяются права, manifests, журнал, metadata, xattrs и отсутствие raw identity/historical binding в outputs. После CMC-21 packaged stdio E2E собирает production artifact, использует synthetic HOME/state и доказывает этот actionable case, move/restore и fail-closed incomplete coverage без реальной mutation Mac.

## Fault injection

Процесс принудительно останавливается до записи manifest, после `prepared`, сразу после rename и до финальной записи журнала. Следующий запуск обязан восстановить однозначное состояние либо заблокировать mutation-контур.

## Race tests

Между preview и действием меняются inode, содержимое, OS owner, artifact/owner binding, requirement profile, applicability, тип объекта, исходный родитель, link boundary, mount ID, owner app/executable, process/open-file/startup/uninstaller/receipt/dependency state, coverage digest и correlation revision. Каждое изменение должно приводить к typed blocking error.

Отдельная матрица покрывает гонку `audit_cancel` с `completed`, `completed_with_warnings` и `failed`. В каждом запуске фиксируется ровно один terminal state; повторная отмена не запускает нового действия. Перед mutation также подменяются owner identity, protected-scope match и sensitivity flags; каждый случай завершается fail closed.

## UI tests

Проверяются пять вкладок, состояния загрузки и отмены, coverage warnings, `supportLevel`, безопасные owner/profile facts, `FindingFacts`, `ReclaimEstimate`, evidence `Sheet`, «Переместить в карантин», «Исключить», «Пропустить сейчас», Quarantine Center, Exclusions, Schedule, пустые состояния, пять показателей, отсутствие кнопки при запрете policy, точный текст `AlertDialog`, одно действие за подтверждение, keyboard navigation, focus return и корректная обработка expired token. Отдельные negative tests доказывают отсутствие bulk action, shell-команд, tool call при «Пропустить сейчас», direct delete исходника и обхода policy прямым tool call.

Schedule tests v0.1 проверяют инертность schema/intent skeleton, `enabled=false`, отсутствие automation ID, opt-in/lifecycle controls, next/last scheduled run и host/system scheduler side effects. Вкладка предлагает ручной `application_remnants` через обычный audit flow; MCP App не вызывает host-native tool, cron или LaunchAgent. Duplicate/update/pause/resume/delete и scheduled-prompt tests перенесены в post-v0.1 CMC-13.

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
* schedule tab честно показывает disabled/manual-run fallback и не создаёт native automation или system scheduler;
* clean-room запуск в новой задаче Codex без копирования команд;
* отсутствие сетевых запросов во время основного сценария;
* package privacy scan не находит username, реальные home paths, персональный app inventory или developer decisions.

# Тестовые данные

Fixtures и E2E используют только generated synthetic identities и содержимое. Checked-in data содержит seed/specification и safe expected digests, но не raw paths, app inventory, bundle/package/signing claim set или tokens. Репозиторий, snapshots, test output, CI и PR artifacts не должны содержать реальные домашние пути, список приложений пользователя, секреты, subscription URLs или снимки личной системы.

# Нефункциональные проверки

* audit status остаётся отзывчивым на большой синтетической выборке;
* память ограничена streaming-обработкой NDJSON, а не загрузкой всех findings;
* отмена read-only аудита не оставляет mutation state;
* автономный UI bundle работает без CDN и сети;
* package и release artifact проходят dependency, license и provenance checks.

# Связанные концепты

* [Модель угроз](../safety/threat-model.md)
* [Критерии приёмки](acceptance-gates.md)
