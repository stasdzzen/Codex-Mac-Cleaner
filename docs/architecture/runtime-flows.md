---
type: Runtime Flow
title: Основные runtime-потоки
description: Последовательности аудита, карантина, восстановления, очистки и recovery.
tags: [architecture, flows, audit, quarantine]
status: approved
owner: Architect
date: 2026-07-15
---

# Аудит

1. `audit_start` принимает новый `requestId` и профиль `application_remnants`.
2. Capability Scanner фиксирует доступные корни, разрешения и источники.
3. Protected Scope Registry исключает запрещённые prefixes, owner identities и локальные Git-проекты до создания кандидатов.
4. Snapshot A фиксирует состояние путей, приложений, процессов и открытых файлов.
5. Независимые candidate adapters и targeted inspection sources возвращают observations и warnings.
6. Safe Metadata Filter редактирует JSON/YAML/plist до persistence.
7. Normalizer связывает observations в находки и назначает `supportLevel`.
8. Snapshot B повторно проверяет изменяемые признаки.
9. Изменившиеся объекты получают `staleDuringAudit: true` и пустой список действий.
10. Classifier формирует метку, уверенность и объяснение по независимым owner, activity, receipt, dependency, temporal и data-kind evidence.
11. Policy Engine вычисляет `allowedActions`; `analysis_only` и `unsupported_manual` не получают mutation actions.
12. Local Store сохраняет immutable audit revision, `StorageSummary` и `DiskObservation` без сырых конфигурационных значений.
13. Dashboard получает краткий `structuredContent` и подробный widget-only `_meta`.

Состояния аудита: `queued`, `running`, `cancelling`, `cancelled`, `completed`, `completed_with_warnings`, `failed`.

# Отмена аудита

1. Codex или Dashboard вызывает `audit_cancel` с `auditId` и новым `requestId`.
2. Coordinator атомарно переводит `queued` или `running` в `cancelling` и передаёт cancellation signal adapters.
3. Adapters завершают текущий безопасный шаг, закрывают потоки записи и не начинают новый источник.
4. Local Store сохраняет частичный отчёт как `cancelled`; все находки получают пустые `allowedActions`.
5. Если terminal state записано до запроса отмены, сервер возвращает это состояние без нового действия.
6. Повторный `audit_cancel` с тем же `requestId` идемпотентен.

# Перемещение в карантин

1. App вызывает `quarantine_prepare_move` с `findingId` и `auditRevision`.
2. Сервер повторяет policy check и возвращает preview token со сроком пять минут.
3. `AlertDialog` показывает объект, физический размер, риск и условия восстановления.
4. После подтверждения App вызывает `quarantine_move` с token и `operationId`.
5. Action Controller берёт lock и повторяет path, inode, owner, mtime, device, process и open-file checks.
6. Action Controller повторно проверяет Protected Scope Registry, `supportLevel` и sensitivity flags.
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

# Пользовательский no-op

«Оставить» не вызывает MCP tool. Widget помечает `findingId` просмотренным только для текущей ревизии и UI-сеанса. Новый аудит начинает список заново.

# Unsupported/manual finding

Системный или shared-объект получает `supportLevel=unsupported_manual`, безопасное объяснение границы v0.1 и только действие `inspect`. Сервер и Skill не возвращают shell-команду, `sudo`-совет или mutation preview.

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
