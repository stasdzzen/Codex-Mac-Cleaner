---
type: Safety Policy
title: Модель безопасности
description: Доверенные границы, серверная политика и инварианты безопасных действий.
tags: [safety, policy, quarantine, restore]
status: approved
owner: Architect
date: 2026-07-19
---

# Цель

Codex Mac Cleaner должен предпочитать пропуск потенциального мусора риску потери данных. Read-only аудит и mutation-контур разделены. Модель и интерфейс не могут обойти серверную политику.

# Доверенные границы

* Skill и диалог помогают выбрать сценарий, но не разрешают файловые операции.
* MCP App показывает результат и собирает явное подтверждение одного действия над одним объектом.
* Локальный MCP-сервер нормализует пути, повторно проверяет состояние и вычисляет `allowedActions`.
* Файловая система и результаты внешних утилит считаются недоверенным вводом.
* Только policy engine может открыть mutation-tool для конкретной immutable audit/correlation revision и Snapshot B fingerprint.

# Классы данных

| Класс | Примеры | Максимальное действие в v0.1 |
|---|---|---|
| Приватные регенерируемые остатки | только cache и log, прошедшие `private_regenerable_remnant_v1` | Пообъектный карантин при полном authoritative evidence |
| Данные поддержки приложения | Application Support, Containers, Group Containers, WebKit, HTTPStorages, Saved Application State, Preferences | Только анализ и объяснение в v0.1 |
| Данные повышенного риска | базы данных, sync- и VPN-данные, личные файлы | Только анализ и объяснение |
| Системные и shared-объекты | системный автозапуск, helpers, receipts, защищённые корни | `unsupported_manual`, только безопасная инспекция |

# Обязательные инварианты

1. Аудит по умолчанию ничего не изменяет.
2. Mutation-tool не принимает произвольный путь от модели или UI.
3. Классификация и разрешение действия вычисляются отдельно.
4. Действие привязано к неизменяемой ревизии аудита и повторно проверенному fingerprint.
5. Одна операция относится к одному объекту верхнего уровня.
6. Симлинк, mount point, смена тома или расхождение snapshot блокируют действие.
7. Карантин выполняется атомарным rename на том же APFS-томе.
8. До rename записывается durable manifest в состоянии `prepared`.
9. Восстановление возможно только в исходный путь, не создаёт заново изменившуюся цепочку родителей и никогда не перезаписывает существующий объект.
10. Окончательная очистка запускается только вручную, относится к одному payload и не выполняется автоматически по сроку.
11. Несогласованный manifest блокирует все destructive-tools до ручного разбора.
12. Полные пути и подробные локальные доказательства не передаются модели.
13. Находки отменённого аудита всегда имеют пустые `allowedActions`.
14. Метрику `purgedPhysicalBytes` нельзя показывать как точно освобождённое место APFS.
15. Universal protected classes — system scope, credential stores, browser profiles, personal data, current project root, plugin-owned state, `~/.codex` и локальные Git-проекты — исключаются server-side до кандидатов и перед mutation.
16. Совпадение имени не может само создать `orphaned` или разрешить `prepare_move`.
17. Пароли, токены, subscription URLs и сырые конфигурационные значения редактируются до persistence и MCP output.
18. `unsupported_manual` не содержит mutation actions, shell-команд или sudo-рекомендаций.
19. Кэш активного приложения не получает mutation action.
20. Персональные пути и названия приложений разработчика отсутствуют в built-in policy публичного bundle.
21. `UserExclusion` не ослабляет `ProtectedScopeRule`, не разрешает mutation и не совпадает только по строковому пути.
22. Совпавший exclusion не получает destructive token; identity mismatch снова показывает finding.
23. «Переместить в карантин» в v0.1 всегда означает подтверждённый quarantine одного объекта, а не direct delete исходника.
24. В v0.1 scheduled audit не создаётся: инертный skeleton и disabled/manual-run UI не получают host action или mutation token.
25. Отсутствие automation в v0.1 и отсутствие Codex automation capability после v0.1 не обходятся через cron, LaunchAgent или скрытый scheduler.
26. Path, basename, display name, bundle ID, package ID, signer display name или OS owner по отдельности не разрешают correlation relation или mutation.
27. `absent` допустим только при полном source coverage и завершённом same-snapshot query с `CoverageCertificate`; пустой ответ источника не является доказательством.
28. Permission/capability gap, partial inventory, parse loss, ambiguous/missing/mismatch identity и stale Snapshot A/B дают `unknown` и блокируют mutation.
29. Positive installed/process/open-file/startup/receipt/dependency counter-evidence блокирует действие независимо от полноты negative inventory.
30. Raw paths, directory chains, app inventory, bundle/package/signing identities, correlation graph и token material не передаются модели или widget и не попадают в логи, telemetry, persisted reports, fixtures или PR evidence. Widget-only `_meta` может содержать только очищенное basename одного верхнеуровневого компонента; model-visible label остаётся generic.
31. Widget показывает только safe facts и server-owned actions; token остаётся server-side и привязан к immutable correlation revision.
32. Persistent identity использует installation-local keyed digest с domain separation; публичная salt или plain hash не считаются защитой от dictionary attack.
33. Library cleanup-target и приложение-владелец являются разными correlation subjects; existence одного не подменяет lifecycle другого.
34. Owner binding для mutation создаёт только authoritative `remnant_of` из exact receipt payload, OS-owned container metadata или валидного installation-local signed process/open-file history.
35. Path, basename, display name, bundle-ID-only и user attestation являются hints и никогда не повышаются до owner binding.
36. `not_applicable` не является `absent`, не создаёт CoverageCertificate, не заменяет failed query и не подавляет positive evidence.
37. Единственный actionable profile v0.1 — `private_regenerable_remnant_v1`; он применим только к category `cache | log`.
38. Application Support, Containers, Group Containers, Preferences, WebKit, HTTPStorages, Saved Application State, database, sync/VPN/personal и autostart остаются inspect-only независимо от confidence.
39. Legacy `targetExecutableState` analysis-only и не может участвовать в выдаче action token.
40. Historical owner binding хранит только keyed digests и инвалидируется при rekey, migration mismatch, смене artifact root/type/identity, owner identity или strong counter-evidence.
41. Missing-target autostart является только диагностикой: user LaunchAgent получает `analysis_only`, системный LaunchAgent/LaunchDaemon — `unsupported_manual`; неизвестный target не считается отсутствующим, а standalone helper не классифицируется по имени.
42. Активный процесс, open file или существующий startup target является blocking counter-evidence и не называется мусором; runtime не завершает процесс, не отключает plist и не изменяет system helper. Process diagnostic допустим только для абсолютного executable с точным `ENOENT`; PID и полный путь остаются server-only.

# Разрешение карантина

`prepare_move` доступен только одновременно при следующих условиях:

* путь находится в разрешённом пользовательском корне;
* category равна `cache` или `log`, а profile равен `private_regenerable_remnant_v1`;
* cleanup-target и owner application разрешены как разные subjects с authoritative `remnant_of` binding;
* правило классификации названо и воспроизводимо;
* уверенность достаточна для конкретной категории;
* отсутствуют активный процесс, открытый файл, mount point, link boundary и protected path;
* приложение-владелец и его executable доказанно отсутствуют по каноническим app inventory scopes;
* нет признаков пользовательских, синхронизируемых или общих данных;
* capability report содержит сведения, обязательные для применённого правила;
* каждое `required` negative fact имеет полный same-snapshot `CoverageCertificate`, `unsupported` отсутствует, а correlation revision не stale;
* `supportLevel` равен `candidate`, а Protected Scope Registry не нашёл совпадений;
* User Exclusion Store не нашёл совпадающей stable identity;
* owner identity, installed state, receipt lifecycle (`absent | stale`), dependencies/applicability, activity и data kind не противоречат действию;
* официальный uninstaller не является рекомендуемым безопасным способом для этого объекта;
* `SafeMetadata.sensitivityFlags` не содержит credentials, tokens, subscription URL, personal data, database или local project.

Одной метки `orphaned`, name match, `not_applicable` или отсутствия приложения в одном источнике для разрешения недостаточно.

# Восстановление после сбоя

При запуске сервер сверяет журнал, manifest, исходный путь и payload:

* source есть, payload нет — операция остаётся `prepared` или отменяется без изменений;
* source нет, payload есть — операция фиксируется как `moved`;
* source и payload есть одновременно — `OPERATION_CONFLICT`, автоматических действий нет;
* source и payload отсутствуют — `MANIFEST_INCONSISTENT`, mutation-контур блокируется.

# Privacy

Продукт работает локально, не использует сеть и телеметрию. Логи не содержат содержимое файлов, секреты, subscription URLs, сырые ключи/значения конфигурации, полный путь, app inventory, bundle/package/signing claims, correlation edges, tokens или необработанный вывод утилит. Model-visible ответы и widget используют только safe display facts, категорию, `supportLevel`, размеры, coverage gaps и blocking reasons без обратимо обезличенного пути. Публичный bundle, checked-in fixtures, snapshots, docs и PR evidence не содержат username, реальные домашние пути, app inventory или персональные решения разработчика. Raw synthetic inputs создаются только runtime test builder во временной области.

# Связанные концепты

* [Политика путей](path-policy.md)
* [Манифест карантина](../contracts/quarantine-manifest.md)
* [Контракт ошибок](../contracts/errors.md)
* [Correlation identity](../contracts/correlation-identity.md)
* [ADR-0013](../decisions/ADR-0013-actionable-library-remnant-correlation.md)
