---
type: Acceptance Gate
title: Критерии приёмки и release gates
description: Блокирующие условия готовности реализации, плагина и релиза Codex Mac Cleaner.
tags: [quality, acceptance, release, gates]
status: approved
owner: Architect
date: 2026-07-23
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
* `absent` для owner app/executable, process/open-file/startup/uninstaller/receipt/dependency выводится только при полном source coverage, завершённом same-snapshot query и валидном completeness certificate; пустой source result недостаточен.
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
* Production inventory установленного owner покрывает `/Applications`, `/System/Applications`, `~/Applications` и package-registered bundles; Spotlight остаётся supplemental source. Uninstaller inventory покрывает те же roots и package-registered uninstallers.
* Cleanup-target и owner application представлены разными subjects; только authoritative `remnant_of` создаёт binding. Legacy `targetExecutableState` остаётся analysis-only.

# Gate D — server-only policy

* Mutation schemas не содержат path или destination.
* Model-visible tools не могут вызвать mutation напрямую.
* Запрещённая категория, stale revision, changed fingerprint, active process, open file, link, mount point и coverage gap блокируют действие.
* Прямая подделка UI state или tool request не меняет `allowedActions`.
* Built-in protected scopes нельзя ослабить через UI, model input, config или forged finding ID; сервер возвращает `PROTECTED_SCOPE`.
* Name-only, sensitive/personal data, local Git project и кэш активного приложения блокируют mutation.
* Path-only, display-name-only, bundle/package/signing/owner single-claim resolution не создаёт action authority; ambiguous/missing/mismatch работают fail closed.
* Только exact receipt payload, OS-owned container metadata или валидный installation-local signed process/open-file history могут создать authoritative owner binding; user attestation остаётся hint.
* Единственный actionable профиль v0.1 — `private_regenerable_remnant_v1` для `cache | log`; Application Support, Containers/Group Containers, Preferences, WebKit/HTTPStorages, Saved State, databases, sync/VPN/personal/autostart остаются inspect-only.
* `not_applicable` не является `absent`, не создаёт certificate, не заменяет failed query и не подавляет positive evidence; `unsupported` блокирует mutation.
* Destructive token server-only и привязан к immutable audit/correlation revision, Snapshot B candidate/parent fingerprints, owner-binding/profile/edge/coverage digests, policy/derivation versions и exclusion state; widget получает только opaque action handle.
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
* Raw app inventory, bundle/package/signing identities, historical owner bindings, correlation graph, coverage certificates и destructive token material отсутствуют также в widget hydration, persisted safe reports, test snapshots и package artifacts.
* Widget получает только `SafeCorrelationView` и server-owned actions, не вычисляет identity, evidence state, coverage completeness или policy.
* В основном пользовательском сценарии нет сетевых запросов и телеметрии.
* Dashboard использует semantic tokens, тёмную тему и утверждённые shadcn/ui components.
* Coverage warning, риск, уверенность и причина запрета действия различимы без опоры только на цвет.
* Dashboard v4 имеет четыре вкладки и grouped-таблицу на «Обзоре»; Quarantine Center выполняет последовательные поэлементные restore/purge без bulk token.
* Последняя completed revision переживает restart в versioned HMAC-envelope, открывается через `dashboard_open(null/null)` и не переиспользует mutation authority без revalidation.
* UI показывает `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes` и timestamped `DiskObservation` без самостоятельного пересчёта и причинного APFS delta.
* «Пропустить сейчас» — session-local no-op без tool call; «Исключить» создаёт versioned local state, а «Переместить в карантин» означает подтверждённый quarantine одного объекта.
* Вкладка «Исключения» поддерживает persistence, search/filter, «Снова проверять», поэлементное удаление и подтверждаемый reset all.
* Exclusion store содержит installation-keyed domain-separated digests без plaintext identity; plain hash/public salt отклоняются, legacy migration atomic и fail closed.
* Вкладка «Расписание» v0.1 показывает только честный disabled/manual-run fallback; opt-in, day/time, next/last scheduled run и lifecycle controls отсутствуют.
* Инертный schedule skeleton не создаёт intent с host side effect или automation ID; cron, LaunchAgent и скрытый fallback отсутствуют.
* `unsupported_manual` содержит только объяснение границы, без mutation, `sudo` и готовой shell-команды.
* Вкладки, диалоги и действия доступны с клавиатуры и возвращают focus после закрытия.

# Gate H — распространение

* Clean-room установка из repository marketplace работает по опубликованной инструкции.
* `.codex-plugin/plugin.json`, `.mcp.json` и `SKILL.md` проходят schema и smoke checks.
* Packaged surface probe на синтетическом `HOME` подтверждает точные 9 model-visible и 15 app-only tools, их visibility metadata, Dashboard v4 URI/MIME/CSP и plugin-relative Node stdio без HTTP/terminal fallback.
* Capability matrix совпадает с probe; tool/resource/visibility drift даёт ненулевой exit code, а stderr не раскрывает абсолютные локальные пути.
* GitHub Release содержит checksum, SBOM и provenance, связанные с tag и commit.
* Clean-room запуск в новой задаче Codex открывает аудит и Dashboard без копирования команд в терминал.
* Missing task-scoped tools приводят к одному штатному host discovery и затем к fail-closed остановке; прямой stdio, Terminal, local HTML, ложный claim об открытом Dashboard и автоматический rescan отсутствуют.
* Успешный terminal state передаёт точную revision в `audit_results`/`dashboard_open`; `revision=null`, `AUDIT_STALE` и stale/cross-channel cursor не создают actionable или повторный run.
* Результаты на 101 и 2 767 findings полностью обходятся страницами до 100 findings/512 КиБ, а host notification той же revision не стирает уже загруженные Widget-страницы.
* Все решения пользователя выполняются отдельными кнопками для одного объекта; terminal confirmation flow отсутствует.
* Clean-room v0.1 не заявляет scheduled run или host automation lifecycle; manual fallback запускает обычный read-only audit без mutation token и `sudo`.
* Duplicate, update, pause, resume, delete automation и scheduled-prompt behavior не являются Gate H v0.1 и проверяются только в post-v0.1 CMC-13 после owner decision.
* Публичный package allowlist и privacy scan не находят username, home paths, персональные app names/decisions или real-Mac inventory.
* После merge CMC-22 тот же CMC-21 PR #38 проходит deterministic synthetic fixtures, binding/profile/coverage/ambiguity/mismatch matrix и production `~/Library/Caches|Logs` audit → prepare → move → restore integration до возобновления CMC-09; затем тот же PR #34 проходит packaged stdio E2E до merge.
* Real-Mac smoke на macOS 26 Apple Silicon подписан отдельным проверяющим или приложен как воспроизводимый протокол.

# Решение о готовности

Любой невыполненный пункт Gate D, E или F блокирует merge и release. Невыполненные `REQ-CANCEL-01`, `REQ-CORR-01`, `REQ-OWNER-BIND-01`, `REQ-PROFILE-01`, `REQ-NEG-01`, `REQ-QCTR-01`, `REQ-SIZE-01`, `REQ-PROT-01`, `REQ-META-01`, `REQ-EXCL-01`, `REQ-SCHED-01`, `REQ-PUB-01` или `REQ-NOCLI-01` блокируют release. Ручной gate нельзя обозначить выполненным без факта проверки. Временное исключение возможно только через отдельный ADR, который не ослабляет инварианты безопасности.
