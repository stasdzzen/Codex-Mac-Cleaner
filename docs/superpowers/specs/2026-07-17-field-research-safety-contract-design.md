---
type: Architecture
title: Полевой safety-контракт Codex Mac Cleaner v0.1
description: Дизайн защищённых областей, безопасных метаданных, inspection-only находок и наблюдаемых метрик диска.
tags: [architecture, safety, privacy, field-research, ui]
status: approved
owner: Architect
date: 2026-07-17
---

# Цель

Перенести результаты ручного аудита реального Mac в проверяемые требования v0.1, не превращая конкретные данные владельца в fixtures, логи или модельный контекст.

Разделы о protected scopes и пользовательском выборе заменены ADR-0011 и [спецификацией публичного продукта](2026-07-17-public-plugin-contract-design.md). Этот документ сохраняет полевые safety-уроки без private examples.

Первый релиз остаётся локальным плагином Codex с единственным профилем `application_remnants`. Аудит запускается без терминала, решение принимается кнопкой для одного объекта, а изменение файловой системы выполняет только локальный MCP-сервер после повторной проверки.

# Gap-матрица

| Статус | Полевой факт | Действие |
|---|---|---|
| Уже покрыто каноном | Read-only аудит, evidence, раздельная policy, поэлементный quarantine/restore/purge, отсутствие bulk и автоматической очистки | Сохранить без ослабления |
| Требует уточнения | Универсальные защищённые классы, безопасное чтение JSON/YAML/plist, пользовательские решения, системные находки без готовых команд, запуск без терминала | Добавить в канон, Product-документы и существующие Issues |
| Требует архитектурного решения | Неизменяемые protected scopes, `supportLevel`, `SafeMetadata`, `DiskObservation` и логический размер находок | Зафиксировать ADR-0010 |
| Намеренно вне v0.1 | Developer caches, Homebrew/SDK management, `/Library` mutation, `sudo`, privileged helper, APFS/Time Machine management | Не добавлять в backlog v0.1 |

Новая implementation Issue не нужна: код ещё не создан, а изменения полностью распределяются по CMC-03, CMC-04, CMC-05, CMC-07, CMC-08, CMC-09 и CMC-10.

# Защищённые области

`ProtectedScopeRule` — встроенное неизменяемое правило локального сервера. UI, модель, Skill, конфигурация плагина и MCP input не могут удалить, ослабить или обойти правило.

Правило имеет серверный `ruleId`, вид `canonical_prefix | owner_identity | local_git_repository`, безопасное объяснение и непустой набор эффектов `exclude_from_candidates | block_mutation`. Встроенные hard exclusions используют оба эффекта. Реальные пути и локальные идентификаторы владельца не входят в model-visible представление правила.

## Обязательные правила

1. `~/.codex`, current project root и plugin-owned state не перечисляются как кандидаты и недоступны для mutation даже при подделанном запросе.
2. Внутри `~/.codex` отдельно считаются защищёнными skills, MCP-конфигурации, plugins, активные sessions, history и settings.
3. Credential stores, browser profiles, personal documents, databases и saves защищаются как универсальные классы без перечисления приложений владельца.
4. Любой локальный Git-проект защищён. Если `.git` как каталог или файл найден в ancestry либо внутри кандидата, весь объект верхнего уровня исключается из mutation.
5. Fixtures используют только синтетические продукты, пути и bundle IDs; персональные решения полевого аудита не входят в public runtime.

Прямой или forged mutation-запрос к защищённой области завершается `PROTECTED_SCOPE`. Ответ модели содержит только безопасную причину «Объект относится к защищённой области» без полного пути и локальной идентичности.

# Уровень поддержки находки

Каждая `Finding` содержит `supportLevel`:

| Значение | Источник | Разрешённые действия |
|---|---|---|
| `candidate` | Девять allowlisted roots пользовательской `Library` | `inspect`, при policy — `reveal` и `prepare_move` |
| `analysis_only` | Разрешённый root, но рискованный или личный тип данных | Только `inspect` и безопасное объяснение |
| `unsupported_manual` | Системный или shared-источник вне mutation scope | Только `inspect`; без mutation, shell-команды и sudo-рекомендации |

Targeted inspection может читать безопасные метаданные user/system LaunchAgents, `/Library/LaunchAgents`, `/Library/LaunchDaemons`, `/Library/PrivilegedHelperTools`, package receipts и shared/system ownership signals. Эти источники не становятся roots для кандидатов. Найденный системный остаток показывается как `unsupported_manual` с объяснением границы v0.1.

Ошибка `Operation not permitted` или TCC-ограничение создаёт coverage warning. Продукт не предлагает `sudo`, отключение защиты или обход разрешений.

# Безопасные метаданные

JSON, YAML и plist считаются недоверенными. Парсер может использовать значение в памяти для локального owner-resolution, но до создания observation обязан свести результат к `SafeMetadata`:

```ts
interface SafeMetadata {
  format: "json" | "yaml" | "plist" | "unknown";
  parseStatus: "not_attempted" | "parsed" | "malformed" | "unsupported";
  byteLength: number;
  modifiedAt: string;
  declaredOwnerDisplayName: string | null;
  sensitivityFlags: readonly (
    | "credentials"
    | "tokens"
    | "subscription_url"
    | "personal_data"
    | "database"
    | "local_project"
  )[];
}
```

В `SafeMetadata`, model-visible output, обычные логи, telemetry, fixtures и PR evidence не попадают сырые ключи и значения, пароли, токены, subscription URLs, содержимое файла, полный путь, stderr или дамп plist. Redaction выполняется на сервере до persistence и формирования MCP-ответа. Все fixtures синтетические.

# Доказательная классификация

Совпадение имени не является доказательством владельца или мусора. Classifier и policy учитывают как отдельные признаки:

* разрешённую owner identity и наличие установленного приложения;
* активный процесс и открытые файлы;
* package receipt и shared dependencies;
* дату использования или доступный безопасный временной признак;
* категорию и sensitivity flags;
* counter-evidence и missing evidence.

Закладки, пароли, письма, контакты, сохранения, локальные проекты, базы, шаблоны, настройки и VPN/proxy-подписки блокируют mutation. Кэш активного приложения также блокируется. Недостаток обязательного evidence даёт `analysis_only`, а не разрешение по имени.

# Пользовательский выбор

Первоначальный session-local no-op заменён ADR-0011. Канонические действия публичного продукта — «Переместить в карантин» для одного объекта, persistent «Исключить» и session-local «Пропустить сейчас». Окончательное удаление остаётся отдельным действием только во вкладке «Карантин» после нового preview.

# Метрики и состояние диска

`StorageSummary` содержит:

* `candidateLogicalBytes` — логическая сумма находок завершённой ревизии;
* `candidatePhysicalBytes` — физическая сумма тех же находок;
* `quarantinePhysicalBytes` — физический размер payload в состоянии `moved`;
* `purgedPhysicalBytes` — накопленная по журналу физическая сумма записей `purged`;
* `stateVersion` — монотонная версия серверного snapshot.

Отдельный server-owned `DiskObservation` содержит `availableBytes`, `totalBytes`, `observedAt` и `source: "statfs"`. Он показывает наблюдаемое состояние тома в момент snapshot, но не доказывает причинную связь с последним действием.

Dashboard отдельно показывает «Логический размер находок», «Физический размер находок», «В карантине», «Удалено навсегда» и «Свободно на диске». UI не вычисляет значения и не показывает `availableBytes` delta как результат purge. APFS snapshots, compression и delayed accounting могут изменить наблюдение независимо от очистителя.

# Сценарий без терминала

1. Пользователь устанавливает плагин из repository или personal marketplace.
2. В новой задаче Codex Skill запускает `application_remnants` и открывает Dashboard.
3. Пользователь не копирует команды и не подтверждает шаги сообщением «готово».
4. Все решения принимаются кнопками «Переместить в карантин», «Исключить», «Пропустить сейчас», «Восстановить» и «Удалить навсегда».
5. `unsupported_manual` содержит только объяснение; продукт не генерирует shell-команду.

Clean-room и new-task tests должны доказать этот путь. Real-Mac smoke остаётся отдельным owner gate и не отмечается выполненным заранее.

# Полевые fixtures и E2E

Синтетический набор покрывает:

* Application Support, Containers, Group Containers, HTTPStorages, WebKit, Preferences, Saved Application State и старый updater;
* installed app, active process, receipt, shared dependency и stale fingerprint;
* browser profile, personal communications, game save, database, local Git project, template/settings и VPN subscription;
* системный launch item, helper, TCC denial и shared component как `unsupported_manual`;
* секретоподобные JSON/YAML/plist без сохранения исходных значений в snapshots и evidence.

Fixture names, paths, bundle IDs и содержимое не копируют реальный Mac. PR evidence содержит только synthetic IDs и агрегированные результаты tests.

# Распределение по Issues

| Issue | Дополнение |
|---|---|
| `CMC-03` | `supportLevel`, `ProtectedScopeRule`, `SafeMetadata`, расширенный `StorageSummary`, `DiskObservation` и строгие schemas |
| `CMC-04` | Полевые synthetic fixtures, безопасные parsers, разделение candidate/inspection-only, TCC warning без sudo |
| `CMC-05` | Protected scopes, personal/sensitive blocks, owner/evidence matrix, запрет name-only классификации |
| `CMC-07` | Обновление summary и disk observation после move/restore/purge без APFS causality claim |
| `CMC-08` | «Переместить в карантин»/«Пропустить сейчас», `supportLevel`, `unsupported_manual`, пять независимых показателей и отсутствие shell UX |
| `CMC-09` | Skill/Dashboard путь без терминала, app-only mutation после клика, точные MCP-выходы |
| `CMC-10` | Denylist, redaction, field-fixture E2E, clean-room/new-task и no-terminal evidence |

# Намеренно вне v0.1

Не сканируются и не очищаются developer caches и среды: uv, npm/nvm, pnpm store, node-gyp, Puppeteer/Chromium, Whisper models, Homebrew downloads/formulae, глобальные Node/Python/uv tools, Docker/Compose/Buildx/Colima, старые SDK и глобальные базы.

Не выполняются mutation в `/Library`, `sudo`, privileged helper, LaunchDaemon management, Homebrew upgrades, APFS/Time Machine snapshot management и глобальное управление SDK. Для изменения этой границы нужен отдельный профиль, threat model и ADR после v0.1.

# Связанные концепты

* [ADR-0010](../../decisions/ADR-0010-field-research-safety-contract.md)
* [ADR-0011](../../decisions/ADR-0011-public-plugin-exclusions-scheduling.md)
* [Доменная модель](../../contracts/domain-model.md)
* [Политика путей](../../safety/path-policy.md)
* [Модель угроз](../../safety/threat-model.md)
* [План реализации](../plans/2026-07-15-codex-mac-cleaner-v01.md)
