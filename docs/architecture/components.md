---
type: Architecture
title: Компоненты Codex Mac Cleaner
description: Обязанности и зависимости компонентов Skill, MCP App и локального MCP-сервера.
tags: [architecture, components, mcp, ui]
status: approved
owner: Architect
date: 2026-07-21
---

# Архитектурный стиль

Плагин использует interactive-decoupled архитектуру: data tools, render tool и mutation-tools разделены. Dashboard открывается сразу после `audit_start`, остаётся смонтированным и обновляется через MCP Apps bridge без повторного создания UI после каждого progress tick или действия.

# Skill

Skill отвечает за диалог:

* объясняет границы и разрешения;
* запускает профиль `application_remnants`;
* сообщает о непроверенных областях;
* открывает Dashboard;
* не генерирует shell-команды и не просит подтверждать шаги сообщением «готово»;
* не интерпретирует файловые пути как разрешение;
* не вызывает app-visible filesystem mutation-tools;
* в v0.1 не вызывает и не заявляет host-native automation; вкладка «Расписание» ведёт только к ручному read-only аудиту. Будущий host bridge относится к CMC-13 после отдельного owner decision.

# MCP App

React/Vite widget использует shadcn/ui и тёмную тему. Основная компоновка — Audit Dashboard:

* `Card` для сводки;
* `Progress` для аудита;
* `Table` для находок;
* `Badge` для меток, уверенности и риска;
* `Sheet` для доказательств;
* `Alert` для coverage gaps и предупреждений;
* `AlertDialog` для карантина, восстановления и очистки;
* `Tabs` для «Обзора», «Находок», «Карантина», «Исключений» и «Расписания»;
* `Button` и `Tooltip` для действий и кратких пояснений;
* `Skeleton` для загрузки;
* `sonner` для короткой обратной связи.

Тема использует semantic tokens shadcn/ui. Raw colors, ручные `dark:` overrides и внешние CDN запрещены. Live progress и nullable pre-result revision используют `ui://codex-mac-cleaner/dashboard-v2.html`; прежний v1 URI не переопределяется.

Widget получает начальный snapshot из ответа `dashboard_open`, в активном состоянии раз в секунду опрашивает `audit_status`, а app-only actions вызывает через MCP Apps bridge. `stateVersion` монотонен: ответ со старой версией или другим `auditId` отбрасывается. Pre-result snapshot имеет `revision=null`, пустые findings/actions и только server-owned phase/counts. Widget state хранит только представление — фильтр, выделенную строку, открытую панель и `skippedFindingIds` текущей ревизии. Raw paths, inventory, bundle/package/signing claims, correlation graph, coverage certificates, destructive token material и решения policy в widget не копируются. «Пропустить сейчас» добавляет ID в session-local список, не вызывает tool и не влияет на новый аудит. «Исключить» вызывает app-visible state action по `findingId`/revision, а не сохраняет identity в browser state.

Карточка finding показывает `SafeCorrelationView` с server-owned `FindingFacts`: компонент, категорию, размеры, время наблюдения, агрегированное owner binding, artifact/owner existence, activity/open-file/startup/uninstaller/receipt/dependency states, requirement profile/applicability, safe coverage gaps, `staleDuringAudit`, sensitivity flags, risk, rule explanation, `ReclaimEstimate`, recommended removal method и blocking reasons. UI не достраивает evidence, не выбирает profile, не трактует `unknown`/`not_applicable` как `absent` и не называет estimate фактическим изменением диска.

Вкладка «Исключения» управляет локальными `UserExclusion`: поиск, фильтр, «Снова проверять», поэлементное удаление и подтверждаемый сброс всех записей. Вкладка «Расписание» v0.1 всегда показывает честное disabled-состояние и действие «Запустить вручную», которое использует обычный read-only audit. Она не показывает opt-in/lifecycle controls, next/last scheduled run и не создаёт host action.

Dashboard показывает server-owned значения «Логический размер находок», «Физический размер находок», «В карантине», «Удалено навсегда» и «Свободно на диске». UI не суммирует данные сам, показывает время наблюдения диска и не трактует его изменение как результат purge.

# Локальный MCP-сервер

Сервер написан на TypeScript/Node.js и включает следующие модули.

## Transport и schemas

Регистрирует tools, UI resource и точные input/output schemas. Все внешние данные проходят runtime-валидацию.

## Audit Coordinator

Управляет жизненным циклом аудита, capability/coverage report, logical snapshot ID, Snapshot A/B, кооперативной отменой и immutable audit/correlation revisions. Частичный отчёт `cancelled`, incomplete source query или `staleDuringAudit` не становятся actionable revision.

## Source Adapters

Каждый адаптер читает один класс источников и возвращает observations, ephemeral typed raw identity claims, query provenance либо structured warnings:

* установленные приложения в `/Applications`, `/System/Applications`, `~/Applications` и package-registered bundles; Spotlight используется только как supplemental source;
* пользовательские Library artifacts;
* процессы и открытые файлы;
* пользовательский автозапуск как candidate evidence и targeted inspection системного автозапуска, missing executable, Background Items и login items;
* package receipts;
* protected container metadata shells и permission gaps;
* официальные uninstallers в тех же app roots и package-registered uninstallers, а также recommended removal method;
* APFS, Time Machine observation и файловые метаданные.

Candidate adapters обходят только девять allowlisted roots пользовательской `Library`. Targeted inspection системных и shared-источников, включая relocated items, helpers, daemons, frameworks и printer/VPN remnants при доступной безопасной capability, создаёт только `unsupported_manual` и никогда не расширяет mutation scope. Active TCP listeners, Homebrew services, cron, StartupItems и system extensions допускаются только как capability gap либо `unsupported_manual`; управление ими отсутствует.

Adapter не объявляет `absent` по пустому массиву и не создаёт общую identity через display name, basename или path. Raw claims существуют только в server process и не входят в `Observation`, persisted report или MCP output.

## Safe Metadata Filter

Разбирает JSON/YAML/plist как недоверенные данные и до persistence оставляет только `SafeMetadata`. Сырые ключи, значения, секреты, subscription URLs, stderr и полный путь отбрасываются.

## Protected Scope Registry

Хранит встроенные неизменяемые правила для system scope, credential stores, browser profiles/cookies/passwords/bookmarks, user documents/projects/repositories/databases/saves, current project root, plugin-owned state, Codex state и локальных Git-проектов. Персональные пути и названия приложений разработчика отсутствуют. Registry проверяется до создания кандидата и повторно в Action Controller; UI и MCP inputs не могут менять его.

## User Exclusion Store

Хранит versioned `UserExclusion` в user Application Support с правами `0600` и atomic write. Identity fields представлены installation-keyed domain-separated digests; key хранится отдельно с `0600`. Matcher использует полный server-owned claim set, а не path/name equality. Identity mismatch снова показывает finding. Совпавшее исключение фильтруется до дорогого анализа и никогда не получает destructive token. Повреждённая/неизвестная схема, отсутствующий key или незавершённая migration не скрывают findings и блокируют destructive-token issuance до восстановления state.

## Schedule Intent Coordinator

Сохраняется как инертная compatibility groundwork: строгие `ScheduleIntent`/`ScheduleState` и tool skeleton не принимают raw RRULE, cron, LaunchAgent, shell или arbitrary prompt. В v0.1 Coordinator не создаёт lifecycle intent, не вызывает host-native automation, держит `enabled=false` и `automationId=null`; UI предлагает обычный ручной `application_remnants`. Создание/update/pause/resume/delete и scheduled prompt принадлежат post-v0.1 CMC-13.

## Correlation Resolver

Строит server-only `CorrelationSubject`/`CorrelationEdge` из ephemeral raw claims и строго разделяет роли `library_artifact` и `owner_application`. Только authoritative `remnant_of` из exact receipt payload, OS-owned container metadata или installation-local signed process/open-file history создаёт `OwnerBinding`. Применяет versioned rules для filesystem/bundle/package/signing/owner identity, обнаруживает `ambiguous | missing | mismatch` и выпускает `CoverageCertificate` только после полного same-snapshot query. Public salt или plain hash не используются из-за dictionary-attack риска.

Resolver формирует immutable `CorrelationRevision`, `SafeCorrelationView` и candidate-specific facts. Он раздельно выводит existence cleanup-target и owner executable/application, а receipt — как lifecycle `live | stale | absent | unknown`. `absent` возможен только при полном source coverage; permission/capability gap, partial inventory, parse loss и ambiguity дают `unknown`. Historical bindings хранятся только installation-keyed и инвалидируются при изменении artifact/owner identity, root/type, key или derivation version.

## Normalizer

Канонизирует observations, принимает только уже разрешённые resolver edges и удаляет дубликаты. `targetRef`, path, basename и display name не являются correlation identity.

## Classifier

Применяет версионированные именованные правила к `EvidenceSet`. Не использует LLM, вероятностную модель или скрытый числовой score.

## Policy Engine

Вычисляет `allowedActions` независимо от classifier. Policy Engine владеет versioned `CorrelationRequirementProfile` и applicability requirements; UI и модель не могут выбрать или ослабить их. Учитывает `supportLevel`, категорию данных, authoritative owner binding, installed/owner executable state, dependencies, активность, открытые файлы, startup/uninstaller, receipt lifecycle, sensitivity flags, completeness certificates, correlation revision и Snapshot A/B fingerprints. Любые required `unknown`, `unsupported`, ambiguity, mismatch или stale state работают fail closed; `not_applicable` не подавляет positive evidence.

Единственный actionable профиль v0.1 — `private_regenerable_remnant_v1` для приватных регенерируемых `cache | log`. Application Support, Containers/Group Containers, Preferences, WebKit/HTTPStorages, Saved State, databases, sync/VPN/personal/autostart остаются inspect-only.

## Action Controller

Хранит preview tokens server-side, выдаёт widget только opaque app-session action handle, блокирует повторное использование, повторно проверяет immutable correlation revision и вызывает quarantine transaction.

## Local Store

Хранит immutable safe reports, append-only journal, operation manifests, versioned keyed exclusions, keyed historical owner bindings и инертный schedule compatibility state без базы данных. Raw identity graph, paths, inventory и tokens в audit report не сохраняются. Historical binding сохраняет только versioned keyed digests и validation metadata.

# Исключённые компоненты

В v0.1 нет Swift-helper, SQLite, облачного backend, аккаунтов, фонового демона, telemetry SDK и native system extension.

# Источники

1. [OpenAI Apps SDK: Define tools](https://developers.openai.com/apps-sdk/plan/tools/)
2. [OpenAI Apps SDK: Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)
3. [shadcn/ui](https://ui.shadcn.com/)
