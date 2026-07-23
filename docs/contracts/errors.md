---
type: Error Contract
title: Контракт ошибок
description: Стабильные error codes, уровни серьёзности и реакция интерфейса.
tags: [contracts, errors, fail-closed]
status: approved
owner: Architect
date: 2026-07-21
---

# Формат

Ошибка содержит `errorCode`, `severity`, `scope`, `message`, `recommendedAction`, `retryable`, `correlationId` и безопасные `details`.

Сырой `stderr`, stack trace, полный путь, inventory, bundle/package/signing claim и token material не попадают в model-visible или widget ответ, лог и PR evidence.

# Уровни

* `warning` — часть покрытия недоступна, но аудит продолжается;
* `blocking` — конкретная находка или операция остановлена;
* `fatal` — mutation-контур полностью заблокирован.

# Канонические коды

| Код | Severity | Реакция |
|---|---|---|
| `CAPABILITY_UNAVAILABLE` | warning | Показать непроверенный источник |
| `PERMISSION_DENIED` | warning или blocking | Показать coverage gap без совета использовать `sudo` или обходить TCC |
| `AUDIT_STALE` | blocking | Повторить аудит |
| `SOURCE_CHANGED` | blocking | Не менять объект; повторить аудит |
| `CORRELATION_AMBIGUOUS` | blocking | Не выбирать совпадение; показать `unknown` и повторить аудит после устранения неоднозначности |
| `CORRELATION_MISSING` | blocking | Не выводить `absent`; показать missing identity evidence |
| `CORRELATION_MISMATCH` | blocking | Сохранить counter-evidence, не создавать edge или mutation preview |
| `CORRELATION_COVERAGE_INCOMPLETE` | blocking | Показать safe coverage gap; пустой source result не считать отсутствием |
| `CORRELATION_SNAPSHOT_STALE` | blocking | Инвалидировать revision/action handle и повторить аудит |
| `CORRELATION_SCHEMA_UNSUPPORTED` | fatal для token issuance | Не использовать legacy/unknown identity как actionable; выполнить поддержанную migration |
| `CORRELATION_KEY_UNAVAILABLE` | fatal для token issuance | Не применять exclusions и не выпускать tokens до восстановления или rekey |
| `CORRELATION_MIGRATION_REQUIRED` | fatal для token issuance | Оставить findings видимыми; завершить или явно сбросить migration state |
| `OWNER_BINDING_MISSING` | blocking | Оставить finding inspect-only; не связывать artifact с app по имени или пути |
| `OWNER_BINDING_STALE` | blocking | Инвалидировать historical binding и повторно построить evidence без mutation authority |
| `REQUIREMENT_PROFILE_UNSUPPORTED` | blocking | Показать границу v0.1; не выдавать profile или applicability со стороны клиента |
| `ACTIVE_PROCESS` | blocking | Закрыть приложение и проверить снова |
| `OPEN_FILE` | blocking | Закрыть потребителя и проверить снова |
| `PATH_OUTSIDE_ALLOWLIST` | blocking | Действие недоступно |
| `PROTECTED_PATH` | blocking | Действие недоступно |
| `PROTECTED_SCOPE` | blocking | Оставить объект без изменений; защищённая область не раскрывается модели |
| `SENSITIVE_DATA` | blocking | Оставить объект; показать безопасную категорию риска без значения секрета |
| `EXCLUDED_FINDING` | blocking | Не создавать mutation preview; объект скрыт пользовательским exclusion |
| `EXCLUSION_IDENTITY_MISMATCH` | warning | Не применять старое exclusion; снова показать новый объект |
| `EXCLUSION_STATE_INVALID` | fatal для token issuance | Не скрывать findings; предложить восстановить или сбросить state после подтверждения |
| `OFFICIAL_UNINSTALLER_REQUIRED` | blocking | Показать штатный способ удаления без shell-команды |
| `UNSUPPORTED_MANUAL` | blocking | Показать объяснение границы v0.1 без готовой команды |
| `SYMLINK_BOUNDARY` | blocking | Оставить объект без изменений |
| `CROSS_VOLUME` | blocking | Карантин недоступен в v0.1 |
| `MOUNT_POINT_DETECTED` | blocking | Карантин недоступен |
| `RESTORE_PATH_OCCUPIED` | blocking | Освободить исходный путь или оставить payload в карантине |
| `RESTORE_PARENT_CHANGED` | blocking | Оставить payload в карантине и повторить аудит исходной области |
| `PREVIEW_EXPIRED` | blocking | Создать новый preview |
| `OPERATION_CONFLICT` | blocking | Открыть журнал и проверить состояние |
| `MANIFEST_INCONSISTENT` | fatal | Заблокировать все destructive-tools |
| `AUTOMATION_CAPABILITY_UNAVAILABLE` | warning | В v0.1 всегда оставить schedule controls disabled и предложить ручной аудит; post-v0.1 capability требует отдельного owner decision |
| `SCHEDULE_INTENT_STALE` | blocking | Обновить состояние расписания и повторить явное действие |
| `SCHEDULE_CONFLICT` | blocking | Не создавать дубликат; показать существующее расписание |
| `INTERNAL_ERROR` | fatal | Показать correlation ID; не повторять мутацию автоматически |

# Правила

* Ошибка одного adapter не завершает весь аудит.
* У всего аудита нет автоматического deadline; таймаут отдельной системной команды
  становится coverage gap и не отменяет остальные проверки.
* Mutation-ошибка всегда работает fail closed.
* Ошибка correlation/coverage никогда не понижается до `absent` и не раскрывает конфликтующие identities.
* `not_applicable` не используется вместо ошибки source query, `unknown` или `absent` и не скрывает positive evidence.
* Автоматически повторяются только read-only операции и идемпотентный replay с тем же ID.
* Каждое пользовательское сообщение объясняет следующий безопасный шаг.
