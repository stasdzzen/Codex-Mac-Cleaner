---
type: Runtime Flow
title: Основные runtime-потоки
description: Последовательности аудита, карантина, восстановления, очистки и recovery.
tags: [architecture, flows, audit, quarantine]
status: approved
owner: Architect
date: 2026-07-19
---

# Аудит

1. `audit_start` принимает новый `requestId` и профиль `application_remnants`.
2. Capability Scanner создаёт logical `snapshotId`, фиксирует доступные корни, permissions, query scopes и источники.
3. Protected Scope Registry исключает универсальные system/credential/browser-profile/personal/project/plugin/Codex scopes до создания кандидатов.
4. Snapshot A фиксирует candidate/parent filesystem identity, source capabilities и начальные fingerprints. Raw paths остаются только в памяти сервера.
5. Adapters выполняют типизированные queries в одном `snapshotId` и возвращают observations, ephemeral raw claims, source provenance и warnings. Пустой output сам по себе не создаёт negative evidence.
6. Correlation Resolver создаёт отдельные `library_artifact` и `owner_application` subjects. Только authoritative `remnant_of` из exact receipt payload, OS-owned container metadata или валидного installation-local signed process/open-file history создаёт owner binding; path, basename, display name, bundle-ID-only и user attestation остаются hints.
7. Для полностью завершённого source scope Resolver выпускает `CoverageCertificate`; permission/capability gap, partial inventory, parse loss, cancellation, ambiguity или mismatch дают `unknown`.
8. User Exclusion Store сопоставляет installation-keyed claim digests до дорогого анализа. Исключённые objects не получают destructive token; migration/key error оставляет findings видимыми и блокирует token issuance.
9. Safe Metadata Filter редактирует JSON/YAML/plist до persistence.
10. Positive installed app, owner executable, process, open-file, startup target, receipt, uninstaller и dependency edges становятся candidate-specific counter-evidence независимо от полноты inventory и не подавляются `not_applicable` другого requirement.
11. Snapshot B повторно проверяет candidate/parent identity и все claims, влияющие на policy. Изменение или невозможность перепроверки дают `staleDuringAudit: true`, инвалидируют negative evidence и очищают mutation actions.
12. Resolver сохраняет immutable `CorrelationRevision` с owner binding/profile fingerprints, digests graph, coverage report, Snapshot A/B и versioned rules; Normalizer создаёт `EvidenceSet` и безопасные `FindingFacts`, раздельные artifact/owner existence states и receipt lifecycle.
13. Classifier формирует метку, уверенность и объяснение по независимым owner, installed, activity, open-file, receipt, dependency, temporal и data-kind evidence.
14. Policy Engine выбирает server-owned requirement profile и applicability, затем вычисляет `allowedActions`. В v0.1 `prepare_move` возможен только для `private_regenerable_remnant_v1`, category `cache | log`, authoritative owner binding, отсутствующего owner/executable, полного required coverage, receipt `absent | stale`, безопасного regenerable data kind и стабильных Snapshot A/B. Обязательный `unknown`, `unsupported`, ambiguity, mismatch, stale revision, positive counter-evidence, `analysis_only`, `unsupported_manual` и excluded identity не получают mutation actions. `not_applicable` не является `absent`. Применимый официальный uninstaller блокирует manual quarantine.
15. Local Store сохраняет safe immutable audit/correlation revision, `StorageSummary`, `DiskObservation` и агрегированный coverage/excluded count без raw identity graph, inventory, path или token material.
16. Модель и Dashboard получают только `SafeCorrelationView`; widget-only `_meta` не содержит raw identities или paths.

Состояния аудита: `queued`, `running`, `cancelling`, `cancelled`, `completed`, `completed_with_warnings`, `failed`.

# Отмена аудита

1. Codex или Dashboard вызывает `audit_cancel` с `auditId` и новым `requestId`.
2. Coordinator атомарно переводит `queued` или `running` в `cancelling` и передаёт cancellation signal adapters.
3. Adapters завершают текущий безопасный шаг, закрывают потоки записи и не начинают новый источник.
4. Local Store сохраняет частичный отчёт как `cancelled`; все находки получают пустые `allowedActions`.
5. Если terminal state записано до запроса отмены, сервер возвращает это состояние без нового действия.
6. Повторный `audit_cancel` с тем же `requestId` идемпотентен.

# Перемещение в карантин

1. Пользователь нажимает «Переместить в карантин»; App вызывает `quarantine_prepare_move` с `findingId` и `auditRevision`.
2. Сервер повторяет policy check на той же immutable `CorrelationRevision`, сохраняет preview token внутри server session и возвращает widget безопасный preview с opaque action handle на пять минут.
3. `AlertDialog` показывает объект, `ReclaimEstimate`, риск, последствия и условия восстановления и явно говорит, что исходник будет перемещён в карантин.
4. После подтверждения App вызывает `quarantine_move` с action handle и `operationId`; path, identity и token material во входе отсутствуют.
5. Action Controller берёт lock и повторяет artifact/parent path guard, inode, OS owner, mtime, device, authoritative owner binding, owner app/executable, process/open-file, startup/uninstaller, receipt lifecycle и все required profile queries.
6. Action Controller сверяет audit/correlation revision, binding/profile/edge/coverage digests, exclusion state, Protected Scope Registry, `supportLevel`, category и sensitivity flags. Любое расхождение блокирует действие.
7. Манифест `prepared` записывается через временный файл, `fsync` и atomic rename.
8. Исходный объект перемещается в `payload/object` через `rename` на том же томе.
9. Манифест и append-only journal получают состояние `moved`.

# Восстановление

1. App получает preview через `quarantine_prepare_restore`.
2. Сервер проверяет payload, исходный родитель и отсутствие объекта в исходном пути.
3. Если исходный путь занят, родитель отсутствует или изменился, операция получает `conflicted`; создание родителей, перезапись и альтернативный путь запрещены.
4. После подтверждения `quarantine_restore` атомарно возвращает payload.
5. Journal получает состояние `restored`.

# Окончательная очистка

1. `quarantine_prepare_purge` формирует preview для одной записи.
2. Интерфейс сообщает, что действие необратимо.
3. `quarantine_purge` удаляет только payload внутри проверенного quarantine root.
4. Симлинки удаляются как ссылки; сервер не следует по ним.
5. Journal получает состояние `purged`.

После move, restore и purge сервер возвращает новый `stateVersion`, `StorageSummary` и свежее `DiskObservation`. Failed purge не меняет метрику «Удалено навсегда». Разница двух `DiskObservation` не называется результатом операции.

# Пользовательские исключения

1. «Исключить» вызывает app-visible `exclusion_create` только с `findingId`, `auditRevision` и `requestId`.
2. Сервер повторно разрешает stable subject и полный claim set, derivation выполняет installation-keyed HMAC, записывает только digests атомарно и не создаёт mutation preview.
3. Следующий аудит сравнивает keyed subject/claim digests до дорогого анализа. Path/name-only совпадение недостаточно; owner/type/signing/bundle-package/target mismatch возвращает finding.
4. «Снова проверять» удаляет одну запись по `exclusionId`. Сброс всех exclusions требует отдельного preview token и подтверждения.
5. Неизвестная schema version, missing key или migration-required запись не скрывают findings и блокируют destructive-token issuance до восстановления state.

# Migration correlation state

1. При переходе на новую derivation version сервер инвалидирует legacy actionable audit revisions и preview tokens.
2. Валидный legacy `UserExclusion` преобразуется локально в keyed digests через временный файл, `fsync`, atomic rename и reread validation.
3. Если точная derivation невозможна, exclusion не применяется, finding остаётся видимым, state помечается `migration_required`, а mutation-контур блокируется.
4. Legacy `Observation.targetRef` и `EvidenceSet` читаются только как analysis-only; новый Resolver не выводит `absent` из legacy данных.

# Накопление authoritative historical binding

1. Во время read-only аудита Resolver может наблюдать подписанный executable конкретного owner process и точную open-file relation к Library artifact.
2. После identity validation он сохраняет installation-keyed binding с artifact/owner/type/root fingerprints без raw path или имени.
3. В последующем аудите binding используется только после повторной валидации schema/key/derivation и artifact/owner claims.
4. Rekey, reinstall, изменение artifact type/root/identity, owner identity или conflicting strong evidence инвалидируют binding; finding остаётся inspect-only.
5. Historical binding не создаёт `absent`: owner lifecycle и все required profile queries выполняются заново в текущем snapshot.

# Пользовательский no-op

«Пропустить сейчас» не вызывает MCP tool. Widget помечает `findingId` просмотренным только для текущей ревизии и UI-сеанса. Новый аудит начинает список заново.

# Disabled/manual-run fallback v0.1

1. Вкладка «Расписание» показывает, что автоматический аудит недоступен в v0.1, и не предлагает opt-in, day/time, next/last run или lifecycle actions.
2. Действие «Запустить вручную» использует обычный `audit_start` с профилем `application_remnants`; новый schedule intent и host action не создаются.
3. `ScheduleIntent`/`ScheduleState` и schedule tools остаются инертной compatibility groundwork. Любая lifecycle-команда завершается fail closed; `enabled=false`, `automationId=null`.
4. В v0.1 отсутствуют scheduled prompt, create/update/pause/resume/delete automation, cron, LaunchAgent и скрытый scheduler.
5. Полный host-native lifecycle описан только как post-v0.1 CMC-13 и требует отдельного owner decision по ADR-0014.

# Unsupported/manual finding

Системный или shared-объект получает `supportLevel=unsupported_manual`, безопасное объяснение «Требует расширенного режима» и только действие `inspect`. Сервер и Skill не возвращают shell-команду, `sudo`-совет или mutation preview.

# Recovery после сбоя

При запуске сервер сверяет записи `prepared` с файловой системой:

| Исходный путь | Payload | Результат |
|---|---|---|
| Есть | Нет | `aborted`; исходник не меняется |
| Нет | Есть | `moved`; журнал догоняет фактическое состояние |
| Есть | Есть | `conflicted`; автоматические действия заблокированы |
| Нет | Нет | `inconsistent`; все destructive-tools блокируются |

# Идемпотентность

`requestId` и `operationId` служат ключами идемпотентности. Повторный вызов возвращает уже созданный результат и не выполняет действие второй раз.
