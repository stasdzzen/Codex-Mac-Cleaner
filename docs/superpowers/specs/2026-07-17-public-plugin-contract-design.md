---
type: Design Specification
title: Публичный контракт, постоянные исключения и расписание Codex Mac Cleaner
description: Архитектурная дельта от персонального полевого аудита к публичному local-first плагину.
tags: [design, public-plugin, exclusions, scheduling, privacy]
status: approved
owner: Architect
date: 2026-07-19
---

# Решение

Codex Mac Cleaner становится публичным local-first плагином. Полевой аудит реального Mac остаётся исследовательским источником для универсальных detector cases, но решения владельца, список его приложений, домашние пути и структура проектов не входят в продуктовый runtime, fixtures, документацию или release evidence.

Публичность v0.1 означает открытый репозиторий, устанавливаемый release artifact и repository/personal marketplace. Публикация в общей Plugin Directory остаётся отдельным owner gate.

# Intended vs implemented

Runtime-кода в репозитории ещё нет. Все пункты ниже имеют статус `planned`; ни один не считается реализованным до merge соответствующей Issue с тестовыми доказательствами.

| Область | Уже покрыто каноном | Разрыв | Маршрут |
|---|---|---|---|
| Local-first и приватность | Нет telemetry, сети, полных путей и raw secrets в model-visible output | Публичный bundle ещё не проверяется на персональные решения разработчика | Уточнить `CMC-03`, `CMC-04`, `CMC-05`, `CMC-09`, `CMC-10` |
| Protected scopes | Server-side deny rules, Git-проекты, Codex state, personal/sensitive data | ADR-0010 перечисляет личные продукты и каталог владельца | Новый ADR-0011 и обновление `CMC-03`, `CMC-05`, `CMC-10` |
| Решение по finding | Поэлементный карантин и временное «Оставить» | Нет постоянного «Исключить»; пользовательские кнопки изменились | `CMC-08`, новая `CMC-12` |
| Finding details | Evidence, risk, owner, activity, receipts и размеры существуют раздельно | Нет обязательной компактной сводки и честной reclaim estimate | `CMC-03`, `CMC-04`, `CMC-08` |
| Исключения | Нет | Нет схемы, миграций, identity matching и UI управления | Новая `CMC-12` |
| Ежемесячная проверка | Есть schedule schemas/intents и пятая вкладка как compatibility groundwork | Host lifecycle не входит в v0.1; вкладка должна быть честно disabled с manual-run fallback | ADR-0014/`CMC-23`; post-v0.1 `CMC-13` |
| Универсальные detectors | Application remnants, процессы, open files, launch items, receipts и APFS evidence частично planned | Не описаны missing executable, uninstaller preference, protected container shells и расширенные inspection-only cases | Расширить `CMC-04`, `CMC-05`, `CMC-10` |
| Системная очистка | Системные находки только `unsupported_manual` | Нет trusted privileged helper и отдельной policy | Заблокированная research Issue `CMC-14`, вне v0.1 |
| Browser/developer storage | Developer cleanup вне v0.1 | Нет отдельных профилей для AI models, caches, SDK и runtimes | Заблокированная research Issue `CMC-15`, вне v0.1 |

# Универсальные protected scopes

Неизменяемый server-side registry защищает классы данных, а не предпочтения разработчика:

* системные каталоги macOS и объекты, требующие повышенных прав;
* Keychain и другие хранилища credentials;
* браузерные профили, cookies, passwords и bookmarks;
* пользовательские документы, локальные проекты, репозитории, базы и сохранения;
* рабочий каталог текущей задачи и его ancestry;
* собственные файлы плагина, quarantine, local state и конфигурацию Codex;
* любой объект без server-generated action token и повторно подтверждённой identity.

Персональный каталог и названия конкретных пользовательских приложений не являются встроенными правилами публичного продукта. Локальный Git-проект остаётся защищён независимо от его пути. `~/.codex` остаётся защищён как универсальная область состояния Codex, а не как личное предпочтение владельца.

# Действия над finding

В карточке finding доступны только действия, разрешённые сервером:

* «Переместить в карантин» — пользовательское намерение безопасно убрать объект. Оно всегда открывает отдельное подтверждение и затем перемещает один объект в собственный карантин; исходный объект не удаляется напрямую;
* «Исключить» — создаёт долговременное локальное `UserExclusion` для стабильной identity и не выдаёт destructive action token;
* «Пропустить сейчас» — UI-only no-op текущего audit revision и сеанса; новый аудит снова показывает объект, если он не исключён;
* «Удалить навсегда» существует только для одного payload в Quarantine Center и требует отдельного подтверждения.

Подтверждение «Переместить в карантин» называет объект, оценку физического размера, риск, причину, способ восстановления и явно говорит, что объект будет перемещён в карантин. Один confirm относится только к одному объекту.

# Обязательная сводка finding

Widget показывает:

* понятное имя объекта и связанного компонента;
* категорию, logical/physical size и время последнего надёжного наблюдения;
* состояние основного app bundle: `installed`, `absent` или `unknown`;
* активные процессы и open files;
* login/background/launch items и наличие target executable;
* package receipts и зависимые компоненты;
* sensitivity flags для документов, баз, профилей и сохранений;
* риск, named rule, counter-evidence, blocking reasons и рекомендуемый путь действия;
* `ReclaimEstimate` как snapshot-оценку physical bytes с confidence, basis и limitations.

`ReclaimEstimate` не равен фактическому изменению `df` и не обещает освобождение места. Stale receipt может иметь оценку `0`, даже если он полезен как evidence.

# Постоянные исключения

`UserExclusion` хранится только в `~/Library/Application Support/Codex Mac Cleaner/state/exclusions.json`. Каталог имеет права `0700`, файл — `0600`; запись проходит schema validation, временный файл, `fsync` и atomic rename.

Запись содержит `schemaVersion`, `exclusionId`, `ruleId`, `artifactKind`, нормализованную server-owned target identity, bundle/package identity при наличии, signing identity, owner/type fingerprint, `createdAt` и безопасную reason category. Один строковый путь не считается identity.

Если изменились тип, владелец, signing identity, bundle/package identity или нормализованный target, исключение не совпадает: новый объект снова появляется в аудите. Неизвестная или повреждённая схема не скрывает findings и блокирует создание destructive tokens до безопасного восстановления state.

Совпавшие исключения фильтруются после минимального identity discovery, но до дорогого анализа. Они не получают mutation preview. Итог показывает только «Исключено N».

Вкладка «Исключения» содержит список, дату, категорию, поиск, фильтры и «Снова проверять». Удаление одного исключения действует сразу. «Сбросить все исключения» требует отдельного подтверждения и не изменяет файлы, которые были исключены.

# Ежемесячная проверка

ADR-0014 переносит host-native monthly automation lifecycle за границу v0.1. В первом релизе вкладка «Расписание» всегда показывает disabled state и предлагает запускать обычный read-only `application_remnants` вручную. Она не показывает opt-in, day/time, next/last scheduled run или lifecycle controls.

`ScheduleIntent`/`ScheduleState` и schedule tool skeleton сохраняются как строгая инертная compatibility groundwork: `enabled=false`, opaque automation ID отсутствует, успешный host outcome невозможен. Manual run не создаёт schedule intent и использует существующий audit flow.

Create/update/pause/resume/delete host automation и scheduled prompt относятся только к post-v0.1 CMC-13 после отдельного owner decision. MCP App никогда не вызывает host-native automation напрямую. Ни v0.1, ни будущий bridge не создают cron, LaunchAgent или скрытый scheduler.

# Detector routing

| Случай | v0.1 | После v0.1 |
|---|---|---|
| Application Support, Containers, Group Containers удалённого app | Candidate либо analysis-only по policy | — |
| Protected container metadata shell и TCC denial | Coverage warning/inspection only, без обхода | — |
| Login item или LaunchAgent с отсутствующим executable | Evidence; system scope только `unsupported_manual` | Advanced mutation только после ADR |
| Stale receipt | Inspection evidence, reclaim estimate обычно `0`, удаления нет | Advanced Cleanup |
| Official uninstaller | Приоритетный recommended method; manual quarantine блокируется, если uninstaller применим | — |
| Relocated Items, privileged helpers, daemons, frameworks, printer/VPN remnants | Targeted read-only `unsupported_manual` при доступной безопасной capability | `CMC-14` |
| TCP listeners, Homebrew services, cron, StartupItems, system extensions | Только capability gap или `unsupported_manual`; никакого управления | `CMC-14` |
| Time Machine snapshots | Наблюдение и объяснение без управления | `CMC-14` |
| Browser AI models, обычные caches и Service Worker CacheStorage | Профили/cookies/passwords защищены; активные caches не мутируются | `CMC-15` |
| SDK, runtimes, package-manager caches, duplicate versions и Android emulators | Не сканируются профилем `application_remnants` | `CMC-15` |

# Тестовый контракт

Release-blocking tests v0.1 покрывают Delete/Exclude/Skip-now, persistence и migration исключений, identity mismatch, невозможность mutation исключённого finding, official uninstaller preference, protected container metadata, stale receipt, active/open state, missing executable, отсутствие `sudo`/TCC bypass, инертный schedule skeleton, disabled/manual-run fallback без host/system scheduler, redaction и отсутствие персональных данных разработчика в публичном bundle. Lifecycle/scheduled-prompt tests принадлежат post-v0.1 CMC-13.

Все paths, usernames, bundle IDs, certificates и app names в fixtures синтетические.

# Маршрут backlog

* `CMC-11` — эта архитектурная и продуктовая дельта; только docs/backlog PR.
* `CMC-12` — versioned persistent exclusions и вкладка управления.
* `CMC-23` — ADR-0014 и синхронизация v0.1 с disabled/manual-run fallback.
* `CMC-13` — post-v0.1 capability-aware monthly automation; `cto:blocked` до owner decision и закрытия CMC-10.
* `CMC-14` — заблокированное исследование Advanced Cleanup v0.2 и trusted privileged helper.
* `CMC-15` — заблокированное исследование Browser/Developer Storage profiles v0.2.

Существующие `CMC-03`, `CMC-04`, `CMC-05`, `CMC-08`, `CMC-09` и `CMC-10` обновляются, а не дублируются.

# Источники

1. [Использование Codex с планом ChatGPT](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) — automations, skills, worktrees и Git в Codex app.
2. [Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/) — состав плагина и границы skills/apps.
3. [Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) — различие ChatGPT Tasks и Codex automations.
