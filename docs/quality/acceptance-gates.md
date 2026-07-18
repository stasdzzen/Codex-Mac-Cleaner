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
* Community profile, private vulnerability reporting и публичный support channel доступны.
* `main` принимает изменения только через squash PR со строгим repository check, linear history и ruleset без bypass.
* GitHub Actions ограничены GitHub-owned actions с full-SHA pinning; release tags нельзя обновить или удалить.
* Dependabot, secret scanning, push protection и CodeQL default setup подтверждены live API перед release.

# Gate B — платформа и сборка

* Runtime guard отклоняет не-macOS, macOS ниже 26 и не-`arm64` до сканирования.
* Сервер и автономный UI bundle собираются из чистого checkout фиксированными командами.
* Release artifact не содержит x86_64 payload, debug secrets, абсолютные пути сборочной машины или неподписанные дополнительные binaries.

# Gate C — read-only аудит

* Audit не меняет mtime, xattrs, содержимое или структуру сканируемых объектов.
* Все adapters возвращают observations или typed warnings.
* Coverage gaps видимы и не интерпретируются как «остатков нет».
* `absent` для installed/process/open-file/receipt/dependency выводится только при полном source coverage, завершённом same-snapshot query и валидном completeness certificate; пустой source result недостаточен.
* Permission/capability gap, partial/truncated inventory, parse loss, cancellation, ambiguous/missing/mismatch identity и Snapshot A/B race дают `unknown`/`staleDuringAudit`, а не `absent`.
* Classification воспроизводима named rules и golden tests.
* Обычный аудит не выходит за allowlisted user Library roots.
* `~/.codex`, current project root, plugin-owned state, credential/browser-profile/personal-data classes и локальные Git-проекты не перечисляются как кандидаты; персональных app/path rules в bundle нет.
* JSON/YAML/plist дают только `SafeMetadata`; raw keys/values и secrets отсутствуют в persisted observations.
* Targeted system/shared inspection создаёт только `unsupported_manual` и не расширяет candidate roots.
* Protected container metadata, stale receipts, missing launch executable и official uninstaller дают typed evidence без TCC bypass, `sudo` или manual removal при применимом uninstaller.
* `audit_cancel` идемпотентно переводит активный аудит в `cancelled` и не оставляет незакрытых потоков записи.
* Частичные находки `cancelled` видимы только для чтения и имеют пустые `allowedActions`.
* Deterministic synthetic builder и production adapter contract создают candidate-specific counter-evidence без path/name/display-only matching.

# Gate D — server-only policy

* Mutation schemas не содержат path или destination.
* Model-visible tools не могут вызвать mutation напрямую.
* Запрещённая категория, stale revision, changed fingerprint, active process, open file, link, mount point и coverage gap блокируют действие.
* Прямая подделка UI state или tool request не меняет `allowedActions`.
* Built-in protected scopes нельзя ослабить через UI, model input, config или forged finding ID; сервер возвращает `PROTECTED_SCOPE`.
* Name-only, sensitive/personal data, local Git project и кэш активного приложения блокируют mutation.
* Path-only, display-name-only, bundle/package/signing/owner single-claim resolution не создаёт action authority; ambiguous/missing/mismatch работают fail closed.
* Destructive token server-only и привязан к immutable audit/correlation revision, Snapshot B candidate/parent fingerprints, edge/coverage digests, policy/derivation versions и exclusion state; widget получает только opaque action handle.
* Positive active process, open file, installed app, live startup/receipt/dependency counter-evidence блокирует mutation даже при partial inventory.
* Совпавший `UserExclusion` блокирует preview; path-only match запрещён, а identity mismatch снова показывает finding.
* Повреждённая или неизвестная exclusion schema не скрывает findings и блокирует destructive-token issuance.
* Применимый official uninstaller блокирует manual quarantine и возвращает безопасный recommended method.

# Gate E — карантин и восстановление

* Preview token остаётся server-side и ограничен действием, объектом, UI session, audit/correlation revision, Snapshot B/coverage fingerprints и сроком; widget получает только opaque handle.
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
* Raw app inventory, bundle/package/signing identities, correlation graph, coverage certificates и destructive token material отсутствуют также в widget hydration, persisted safe reports, test snapshots и package artifacts.
* Widget получает только `SafeCorrelationView` и server-owned actions, не вычисляет identity, evidence state, coverage completeness или policy.
* В основном пользовательском сценарии нет сетевых запросов и телеметрии.
* Dashboard использует semantic tokens, тёмную тему и утверждённые shadcn/ui components.
* Coverage warning, риск, уверенность и причина запрета действия различимы без опоры только на цвет.
* Dashboard имеет пять вкладок; Quarantine Center показывает поэлементные restore/purge без bulk action.
* UI показывает `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes` и timestamped `DiskObservation` без самостоятельного пересчёта и причинного APFS delta.
* «Пропустить сейчас» — session-local no-op без tool call; «Исключить» создаёт versioned local state, а «Удалить» означает подтверждённый quarantine одного объекта.
* Вкладка «Исключения» поддерживает persistence, search/filter, «Снова проверять», поэлементное удаление и подтверждаемый reset all.
* Exclusion store содержит installation-keyed domain-separated digests без plaintext identity; plain hash/public salt отклоняются, legacy migration atomic и fail closed.
* Вкладка «Расписание» показывает capability, opt-in, day/time, next/last run и update/pause/resume/delete без raw RRULE.
* Без host automation capability schedule disabled; cron, LaunchAgent и скрытый fallback отсутствуют.
* `unsupported_manual` содержит только объяснение границы, без mutation, `sudo` и готовой shell-команды.
* Вкладки, диалоги и действия доступны с клавиатуры и возвращают focus после закрытия.

# Gate H — распространение

* Clean-room установка из repository marketplace работает по опубликованной инструкции.
* `.codex-plugin/plugin.json`, `.mcp.json` и `SKILL.md` проходят schema и smoke checks.
* GitHub Release содержит checksum, SBOM и provenance, связанные с tag и commit.
* Clean-room запуск в новой задаче Codex открывает аудит и Dashboard без копирования команд в терминал.
* Все решения пользователя выполняются отдельными кнопками для одного объекта; terminal confirmation flow отсутствует.
* Scheduled run выполняет только read-only аудит, применяет exclusions, не создаёт mutation token и не запрашивает `sudo`.
* Повторное включение расписания обновляет одну automation; duplicate, pause, resume и delete покрыты тестами.
* Публичный package allowlist и privacy scan не находят username, home paths, персональные app names/decisions или real-Mac inventory.
* CMC-21 core resolver проходит deterministic synthetic fixtures, coverage/ambiguity/mismatch matrix и safe integration harness до возобновления CMC-09; затем тот же PR #34 проходит packaged stdio audit → prepare → move → restore E2E до merge.
* Real-Mac smoke на macOS 26 Apple Silicon подписан отдельным проверяющим или приложен как воспроизводимый протокол.

# Решение о готовности

Любой невыполненный пункт Gate D, E или F блокирует merge и release. Невыполненные `REQ-CANCEL-01`, `REQ-CORR-01`, `REQ-NEG-01`, `REQ-QCTR-01`, `REQ-SIZE-01`, `REQ-PROT-01`, `REQ-META-01`, `REQ-EXCL-01`, `REQ-SCHED-01`, `REQ-PUB-01` или `REQ-NOCLI-01` блокируют release. Ручной gate нельзя обозначить выполненным без факта проверки. Временное исключение возможно только через отдельный ADR, который не ослабляет инварианты безопасности.
