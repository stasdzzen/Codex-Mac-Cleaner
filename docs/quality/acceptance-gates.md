---
type: Acceptance Gate
title: Критерии приёмки и release gates
description: Блокирующие условия готовности реализации, плагина и релиза Codex Mac Cleaner.
tags: [quality, acceptance, release, gates]
status: approved
owner: Architect
date: 2026-07-15
---

# Gate A — документация и лицензия

* OKF validator проходит без ошибок, битых внутренних ссылок и неизвестных обязательных концептов.
* PRD и implementation plan ссылаются на архитектурный канон без дублирующих противоречивых правил.
* Корневой `LICENSE` заменён на официальный Apache-2.0 до первого implementation commit.
* Package metadata и release metadata указывают Apache-2.0.

# Gate B — платформа и сборка

* Runtime guard отклоняет не-macOS, macOS ниже 26 и не-`arm64` до сканирования.
* Сервер и автономный UI bundle собираются из чистого checkout фиксированными командами.
* Release artifact не содержит x86_64 payload, debug secrets, абсолютные пути сборочной машины или неподписанные дополнительные binaries.

# Gate C — read-only аудит

* Audit не меняет mtime, xattrs, содержимое или структуру сканируемых объектов.
* Все adapters возвращают observations или typed warnings.
* Coverage gaps видимы и не интерпретируются как «остатков нет».
* Classification воспроизводима named rules и golden tests.
* Обычный аудит не выходит за allowlisted user Library roots.
* `~/APPS` и `~/.codex` не перечисляются как кандидаты; field fixtures используют только синтетические identities и paths.
* JSON/YAML/plist дают только `SafeMetadata`; raw keys/values и secrets отсутствуют в persisted observations.
* Targeted system/shared inspection создаёт только `unsupported_manual` и не расширяет candidate roots.
* `audit_cancel` идемпотентно переводит активный аудит в `cancelled` и не оставляет незакрытых потоков записи.
* Частичные находки `cancelled` видимы только для чтения и имеют пустые `allowedActions`.

# Gate D — server-only policy

* Mutation schemas не содержат path или destination.
* Model-visible tools не могут вызвать mutation напрямую.
* Запрещённая категория, stale revision, changed fingerprint, active process, open file, link, mount point и coverage gap блокируют действие.
* Прямая подделка UI state или tool request не меняет `allowedActions`.
* Built-in protected scopes нельзя ослабить через UI, model input, config или forged finding ID; сервер возвращает `PROTECTED_SCOPE`.
* Name-only, sensitive/personal data, local Git project и кэш активного приложения блокируют mutation.

# Gate E — карантин и восстановление

* Preview token ограничен действием, объектом, UI session, fingerprint и сроком.
* Один confirm изменяет не больше одного объекта верхнего уровня.
* Durable `prepared` manifest существует до atomic rename.
* Операция не использует copy-delete и не пересекает том.
* Restore возвращает объект только в свободный исходный путь при неизменившемся родителе и сохраняет проверяемые metadata и xattrs.
* Все fault-injection точки дают восстановимое или fail-closed состояние.

# Gate F — окончательная очистка

* Автоматического purge по времени нет.
* Preview показывает ровно один quarantine payload и необратимость действия.
* Purge не выходит за quarantine root и не следует ссылкам.
* Повторный вызов с тем же operation ID идемпотентен.
* Failed purge не скрывает запись карантина и не увеличивает `purgedPhysicalBytes`.

# Gate G — приватность и UI

* Полные пути, raw config values, пароли, tokens и subscription URLs отсутствуют в model-visible ответах, обычных логах, fixtures и PR evidence.
* В основном пользовательском сценарии нет сетевых запросов и телеметрии.
* Dashboard использует semantic tokens, тёмную тему и утверждённые shadcn/ui components.
* Coverage warning, риск, уверенность и причина запрета действия различимы без опоры только на цвет.
* Dashboard имеет три вкладки; Quarantine Center показывает поэлементные restore/purge без bulk action.
* UI показывает `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes` и timestamped `DiskObservation` без самостоятельного пересчёта и причинного APFS delta.
* «Оставить» — session-local no-op: tool call, filesystem mutation и persistent ignore отсутствуют.
* `unsupported_manual` содержит только объяснение границы, без mutation, `sudo` и готовой shell-команды.
* Вкладки, диалоги и действия доступны с клавиатуры и возвращают focus после закрытия.

# Gate H — распространение

* Clean-room установка из repository marketplace работает по опубликованной инструкции.
* `.codex-plugin/plugin.json`, `.mcp.json` и `SKILL.md` проходят schema и smoke checks.
* GitHub Release содержит checksum, SBOM и provenance, связанные с tag и commit.
* Clean-room запуск в новой задаче Codex открывает аудит и Dashboard без копирования команд в терминал.
* Все решения пользователя выполняются отдельными кнопками для одного объекта; terminal confirmation flow отсутствует.
* Real-Mac smoke на macOS 26 Apple Silicon подписан отдельным проверяющим или приложен как воспроизводимый протокол.

# Решение о готовности

Любой невыполненный пункт Gate D, E или F блокирует merge и release. Невыполненные `REQ-CANCEL-01`, `REQ-QCTR-01`, `REQ-SIZE-01`, `REQ-PROT-01`, `REQ-META-01` или `REQ-NOCLI-01` блокируют release. Ручной gate нельзя обозначить выполненным без факта проверки. Временное исключение возможно только через отдельный ADR, который не ослабляет инварианты безопасности.
