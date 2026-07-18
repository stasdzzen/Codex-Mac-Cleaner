---
type: Path Policy
title: Политика путей и файловых границ
description: Разрешённые корни, запрещённые объекты и алгоритм проверки путей перед действием.
tags: [safety, paths, filesystem, allowlist]
status: approved
owner: Architect
date: 2026-07-15
---

# Разрешённые корни аудита

Профиль `application_remnants` сканирует только явно перечисленные каталоги внутри домашней `Library` текущего пользователя:

* `Caches`;
* `Application Support`;
* `Containers`;
* `Group Containers`;
* `Preferences`;
* `Logs`;
* `HTTPStorages`;
* `WebKit`;
* `Saved Application State`.

Это allowlist, а не начальная точка рекурсивного обхода всей домашней папки. Недоступный root записывается в coverage report.

`~/.codex`, текущий project root и plugin-owned state не являются candidate roots и дополнительно защищены неизменяемыми rules. Scanner не перечисляет их содержимое и не создаёт из них findings. Произвольный пользовательский каталог не становится protected только из-за имени; локальные Git-проекты защищаются детектором ancestry независимо от пути.

# Границы действий

Аудит корня не означает разрешение на карантин. В v0.1:

* `Group Containers` доступны только для анализа;
* `Preferences` по умолчанию доступны для анализа; отдельное разрешающее правило требует ADR;
* системные каталоги и системный автозапуск доступны только для инспекции;
* внешние, сетевые, read-only и не-APFS тома исключены;
* developer roots и artifacts исключены даже при попадании внутрь разрешённого корня;
* root карантина и все его потомки исключаются из обычного аудита отдельным deny rule.

Targeted inspection может читать безопасные метаданные user/system LaunchAgents, `/Library/LaunchAgents`, `/Library/LaunchDaemons`, `/Library/PrivilegedHelperTools`, package receipts, relocated items, зарегистрированные system extensions, printer/VPN remnants и Time Machine observations, если для источника есть отдельная безопасная capability. Эти пути не добавляются в allowlist; их findings получают только `unsupported_manual`. Ошибка разрешения создаёт coverage gap без `sudo` или обхода TCC.

# Неизменяемые protected scopes

Server-side registry блокирует кандидаты или mutation для универсальных классов:

* системных каталогов macOS и объектов, требующих повышенных прав;
* Keychain и других credential stores;
* browser profiles, cookies, passwords и bookmarks;
* user documents, projects, repositories, databases и game/application saves;
* текущего project root и его ancestry;
* plugin-owned reports, quarantine, state и config;
* `~/.codex`, включая skills, MCP configs, plugins, sessions, history и settings;
* любого локального Git-проекта, если `.git` как файл или каталог найден в ancestry либо внутри объекта верхнего уровня.

Список классов встроен в policy package. UI preferences и MCP inputs не могут удалить правило. Персональные app names, owner paths и решения разработчика отсутствуют. Пользовательские `UserExclusion` хранятся отдельно и не могут ослабить registry.

# Запрещённые свойства объекта

Mutation блокируется, если объект или любой компонент ancestry:

* является симлинком;
* является mount point;
* вышел за canonical allowlist после нормализации;
* находится на другом device или mount ID;
* имеет неожиданного владельца;
* относится к protected path;
* изменился после привязанной ревизии аудита;
* содержит границу, которую сервер не может проверить без следования ссылке.

Hardlink сам по себе не обходится. Для обычного файла link count больше ожидаемого блокирует действие; каталоги проверяются по ancestry, inode и mount boundary.

# Алгоритм перед mutation

1. Найти путь только по `findingId` или quarantine manifest.
2. Разобрать путь на компоненты без shell expansion.
3. Проверить абсолютность, отсутствие `..`, NUL и пустых промежуточных компонентов.
4. Через `lstat` пройти ancestry без следования ссылкам.
5. Проверить containment относительно разрешённого root.
6. Проверить owner, file type, device, mount ID и protected-path rules.
7. Проверить Protected Scope Registry, локальный Git marker, current project root, `supportLevel` и sensitivity flags.
8. Проверить отсутствие совпадающего keyed `UserExclusion` и применимого official uninstaller requirement.
9. Сверить immutable audit/correlation revision, Snapshot B fingerprints объекта/родителя и relevant edge/coverage digests.
10. Повторить обязательные process/open-file/installed/receipt/dependency queries; `absent` принять только с полным same-snapshot coverage, иначе блокировать.
11. Убедиться, что path/name-only claim не участвовал в разрешении identity и correlation graph не ambiguous/missing/mismatch.
12. Вычислить фиксированный destination `quarantine/<operation-id>/payload/object`.
13. Повторить критические проверки непосредственно перед atomic rename.

# Карантин

Root карантина создаётся с правами `0700`. Manifest и журнал имеют `0600`. Destination строится из server-generated `operationId`; имя исходного объекта хранится в manifest и не управляет ancestry destination.

Restore разрешён, только если исходный родитель существует, остаётся тем же каталогом по fingerprint и находится внутри ожидаемого разрешённого root. Сервер не создаёт отсутствующие родительские каталоги автоматически.

Purge разрешён только для payload, который одновременно:

* записан в валидном manifest;
* находится по ожидаемому пути `quarantine/<operation-id>/payload/object`;
* совпадает с сохранённой идентичностью;
* не требует перехода по ссылке.

# Запрещённые интерфейсы

В публичных MCP schemas отсутствуют `path`, `destination`, glob, shell command и флаг обхода политики. Exclusion input не принимает path или identity fields. Widget hydration не получает path, inventory, bundle/package/signing claims, correlation graph или token material. Schedule input не принимает raw RRULE, cron expression, LaunchAgent или arbitrary prompt. UI не может предложить восстановление в другое место или принудительное продолжение.

# Связанные концепты

* [Модель безопасности](safety-model.md)
* [Контракт MCP-tools](../contracts/mcp-tools.md)
