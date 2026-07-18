---
type: Safety Policy
title: Модель безопасности
description: Доверенные границы, серверная политика и инварианты безопасных действий.
tags: [safety, policy, quarantine, restore]
status: approved
owner: Architect
date: 2026-07-15
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
| Воспроизводимые данные | caches, logs, WebKit, HTTPStorages, Saved Application State | Карантин при высокой уверенности |
| Данные поддержки приложения | обычный Application Support, обычные Containers | Карантин только при отсутствии приложения, активности и признаков пользовательских данных |
| Данные повышенного риска | Preferences, Group Containers, базы данных, sync- и VPN-данные, личные файлы | Только анализ и объяснение |
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
23. «Удалить» в v0.1 всегда означает подтверждённый quarantine одного объекта, а не direct delete исходника.
24. Scheduled audit всегда read-only, не получает mutation token и не создаётся без явного opt-in.
25. Отсутствие Codex automation capability не обходится через cron, LaunchAgent или скрытый scheduler.
26. Path, basename, display name, bundle ID, package ID, signer display name или OS owner по отдельности не разрешают correlation relation или mutation.
27. `absent` допустим только при полном source coverage и завершённом same-snapshot query с `CoverageCertificate`; пустой ответ источника не является доказательством.
28. Permission/capability gap, partial inventory, parse loss, ambiguous/missing/mismatch identity и stale Snapshot A/B дают `unknown` и блокируют mutation.
29. Positive installed/process/open-file/startup/receipt/dependency counter-evidence блокирует действие независимо от полноты negative inventory.
30. Raw paths, app inventory, bundle/package/signing identities, correlation graph и token material не передаются модели или widget и не попадают в логи, telemetry, persisted reports, fixtures или PR evidence.
31. Widget показывает только safe facts и server-owned actions; token остаётся server-side и привязан к immutable correlation revision.
32. Persistent identity использует installation-local keyed digest с domain separation; публичная salt или plain hash не считаются защитой от dictionary attack.

# Разрешение карантина

`prepare_move` доступен только одновременно при следующих условиях:

* путь находится в разрешённом пользовательском корне;
* категория не входит в analysis-only список;
* правило классификации названо и воспроизводимо;
* уверенность достаточна для конкретной категории;
* отсутствуют активный процесс, открытый файл, mount point, link boundary и protected path;
* приложение-владелец отсутствует там, где это требуется политикой;
* нет признаков пользовательских, синхронизируемых или общих данных;
* capability report содержит сведения, обязательные для применённого правила;
* каждое обязательное negative fact имеет полный same-snapshot `CoverageCertificate`, а correlation revision не stale;
* `supportLevel` равен `candidate`, а Protected Scope Registry не нашёл совпадений;
* User Exclusion Store не нашёл совпадающей stable identity;
* owner identity, installed state, receipts, dependencies, activity и data kind не противоречат действию;
* официальный uninstaller не является рекомендуемым безопасным способом для этого объекта;
* `SafeMetadata.sensitivityFlags` не содержит credentials, tokens, subscription URL, personal data, database или local project.

Одной метки `orphaned` для разрешения недостаточно.

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
