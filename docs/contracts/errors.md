---
type: Error Contract
title: Контракт ошибок
description: Стабильные error codes, уровни серьёзности и реакция интерфейса.
tags: [contracts, errors, fail-closed]
status: approved
owner: Architect
date: 2026-07-15
---

# Формат

Ошибка содержит `errorCode`, `severity`, `scope`, `message`, `recommendedAction`, `retryable`, `correlationId` и безопасные `details`.

Сырой `stderr`, stack trace и полный путь не попадают в model-visible ответ.

# Уровни

* `warning` — часть покрытия недоступна, но аудит продолжается;
* `blocking` — конкретная находка или операция остановлена;
* `fatal` — mutation-контур полностью заблокирован.

# Канонические коды

| Код | Severity | Реакция |
|---|---|---|
| `CAPABILITY_UNAVAILABLE` | warning | Показать непроверенный источник |
| `PERMISSION_DENIED` | warning или blocking | Показать недоступную область и способ расширить доступ |
| `AUDIT_STALE` | blocking | Повторить аудит |
| `SOURCE_CHANGED` | blocking | Не менять объект; повторить аудит |
| `ACTIVE_PROCESS` | blocking | Закрыть приложение и проверить снова |
| `OPEN_FILE` | blocking | Закрыть потребителя и проверить снова |
| `PATH_OUTSIDE_ALLOWLIST` | blocking | Действие недоступно |
| `PROTECTED_PATH` | blocking | Действие недоступно |
| `SYMLINK_BOUNDARY` | blocking | Оставить объект без изменений |
| `CROSS_VOLUME` | blocking | Карантин недоступен в v0.1 |
| `MOUNT_POINT_DETECTED` | blocking | Карантин недоступен |
| `RESTORE_PATH_OCCUPIED` | blocking | Освободить исходный путь или оставить payload в карантине |
| `RESTORE_PARENT_CHANGED` | blocking | Оставить payload в карантине и повторить аудит исходной области |
| `PREVIEW_EXPIRED` | blocking | Создать новый preview |
| `OPERATION_CONFLICT` | blocking | Открыть журнал и проверить состояние |
| `MANIFEST_INCONSISTENT` | fatal | Заблокировать все destructive-tools |
| `INTERNAL_ERROR` | fatal | Показать correlation ID; не повторять мутацию автоматически |

# Правила

* Ошибка одного adapter не завершает весь аудит.
* Mutation-ошибка всегда работает fail closed.
* Автоматически повторяются только read-only операции и идемпотентный replay с тем же ID.
* Каждое пользовательское сообщение объясняет следующий безопасный шаг.
