---
type: Product Requirements
title: PRD Codex Mac Cleaner v0.1
description: Продуктовые требования к безопасному локальному аудиту остатков macOS-приложений.
tags: [product, prd, macos, cleanup]
status: approved
owner: Architect
date: 2026-07-22
---

# 1. Краткое описание

Codex Mac Cleaner — публичный local-first плагин для Codex на macOS 26 и Apple Silicon. Он находит вероятные остатки обычных приложений, показывает проверяемые доказательства и по одному перемещает разрешённые объекты в обратимый карантин.

Продукт не обещает ускорить Mac и не удаляет всё одной кнопкой. Его ценность — понятное решение с безопасным возвратом данных.

# 2. Ответственные

| Роль | Ответственный | Обязанность |
|---|---|---|
| Владелец продукта | Владелец репозитория | Утверждает scope, юридические действия и релиз |
| Архитектор | Текущий архитектурный чат | Поддерживает канон, ADR и safety-инварианты |
| Product | Временно Архитектор | Подготовил этот PRD, roadmap, промпты и Issues |
| Controller | Не назначен | В новой постоянной задаче организует Issue → Worker → PR → review → merge |
| Worker | Назначается на одну Issue | Реализует только свою Issue и передаёт PR на независимую проверку |

# 3. Контекст

После удаления приложения в пользовательской `Library` могут оставаться кэши, журналы, WebKit-данные, сохранённое состояние и каталоги поддержки. Обычный пользователь не может надёжно понять владельца файла, риск удаления и способ восстановления.

Полевой аудит реального Mac подтвердил главную боль: пользователь не хочет копировать команды в терминал и после каждого шага писать «готово». Он хочет увидеть объект, размер, владельца, доказательства, риск и понятную причину, затем нажать «Переместить в карантин», «Исключить» или «Пропустить сейчас». В v0.1 перемещение означает отдельное подтверждение и ровно один объект; окончательный purge остаётся отдельным действием Quarantine Center.

Тот же аудит показал опасные контрпримеры: браузерные профили, письма и мессенджеры, игровые сохранения, локальные проекты и базы, шаблоны, настройки и VPN-подписки могут выглядеть как остатки. Системные helpers, receipts и shared-зависимости нельзя считать мусором по совпадению имени.

Системные очистители часто сводят решение к размеру и кнопке удаления. Для Codex Mac Cleaner основой являются происхождение, контрдоказательства, покрытие аудита и отдельная серверная политика действий.

Первый релиз сознательно ограничен современным окружением macOS 26 на `arm64`. Это позволяет проверить safety-модель без матрицы старых ОС, Intel и Rosetta.

# 4. Цель

Дать пользователю локальный, объяснимый и обратимый способ разобрать остатки удалённых приложений без произвольного доступа модели к файловым путям.

## Ключевые результаты v0.1

1. Все mutation-запросы проходят server-only policy; обход через модель, UI или прямой tool call не проходит contract tests.
2. Каждый разрешённый синтетический объект проходит цикл quarantine → restore с сохранением проверяемых metadata и xattrs.
3. Каждая fault-injection точка даёт однозначное восстановимое состояние или блокирует mutation-контур.
4. Полные пути отсутствуют во всех model-visible ответах и обычных логах в автоматических privacy tests.
5. Clean-room установка опубликованного артефакта и real-Mac smoke на macOS 26 `arm64` имеют свежий протокол на release commit.
6. Отмена read-only аудита оставляет просматриваемый частичный отчёт, но не разрешает mutation.
7. Quarantine Center даёт поэлементное restore/purge и не выдаёт размер `purged` за точно освобождённое место APFS.
8. Универсальные protected classes, включая `~/.codex`, текущий project root, plugin-owned state, credential stores, browser profiles и локальные Git-проекты, доказанно недоступны mutation; персональных product/path rules в публичном bundle нет.
9. JSON/YAML/plist редактируются до persistence: пароль, token, subscription URL, raw value и полный путь отсутствуют в model output, логах, fixtures и PR evidence.
10. Clean-room сценарий в новой задаче Codex запускает аудит и Dashboard без копирования shell-команд.
11. Системные и shared-находки имеют `unsupported_manual`, не предлагают mutation, `sudo` или готовую команду.
12. Persistent exclusions переживают перезапуск, основаны на стабильной identity и не скрывают новый объект при изменившемся owner/type/signing/target.
13. Вкладка «Расписание» v0.1 честно сообщает, что automation недоступна, и предлагает ручной read-only audit; она не создаёт host-native automation, cron, LaunchAgent или скрытый scheduler.
14. Публичный bundle, fixtures и PR evidence не содержат персональных приложений, решений, username, домашних путей или app inventory разработчика.
15. Library candidate получает installed/process/open-file/receipt/dependency facts только через server-owned correlation identity; path/name/display-only matching не создаёт mutation authority.
16. Negative fact `absent` появляется только при полном source coverage и завершённом same-snapshot query; permission/capability/partial/ambiguous/mismatch состояния остаются `unknown`.
17. Widget и модель получают только safe facts/actions; raw paths, app inventory, bundle/package/signing identities, correlation graph и destructive tokens остаются server-only.
18. Library artifact и owner application разрешаются как разные subjects; owner binding создаётся только authoritative relation, а name/path/bundle-only hints не дают action authority.
19. Пообъектный карантин v0.1 доступен только приватным регенерируемым cache/log, прошедшим `private_regenerable_remnant_v1`; остальные Library categories остаются inspect-only.

Эти результаты являются release gates, а не обещанием рыночного эффекта.

# 5. Целевые сегменты

## Основной сегмент

Пользователь Mac, который удалял приложения и хочет вернуть место, но не готов вручную исследовать `~/Library` и рисковать рабочими данными.

Его задача: «Покажи, что осталось от удалённого приложения, почему это считается остатком и как всё вернуть, если решение было ошибочным».

## Вторичный сегмент

Технически опытный пользователь, которому нужен проверяемый локальный отчёт вместо непрозрачной оценки очистителя.

Его задача: «Дай evidence, coverage gaps, текущую policy и журнал операции, не отправляя сведения о системе в сеть».

## Не целевые сегменты v0.1

* разработчики, очищающие build artifacts и package caches;
* пользователи Intel Mac или macOS ниже 26;
* пользователи, ищущие дубликаты личных документов;
* администраторы, которым нужно менять системные службы, VPN, DNS или расширения;
* пользователи, ожидающие автоматическую фоновую очистку.

# 6. Ценностное предложение

## Что получает пользователь

* находки с объяснимыми доказательствами и контрдоказательствами;
* честный список непроверенных областей;
* отдельное разрешение действия, не смешанное с классификацией;
* поэлементный карантин вместо прямого удаления;
* восстановление в исходный путь без перезаписи;
* локальную работу без аккаунта, облака и телеметрии.

## Каких рисков пользователь избегает

* удаления общих, синхронизируемых или личных данных по одному совпадению имени;
* действия по устаревшему аудиту после изменения файла;
* скрытого выхода за разрешённые корни через ссылку или mount point;
* автоматической необратимой очистки карантина;
* передачи модели полного пути и подробностей локальной системы.

## Отличие решения

Главное отличие — policy engine на локальном сервере. Модель объясняет и инициирует read-only сценарии, но не решает, что можно переместить. Кнопка в интерфейсе также не является границей безопасности.

# 7. Решение

## 7.1 Пользовательский сценарий

1. Пользователь просит проверить остатки приложений.
2. Skill объясняет scope и запускает read-only аудит `application_remnants`.
3. Сразу после запуска открывается Dashboard v2 и показывает живую фазу, честные candidate counts, покрытие, сводку размера и вкладки «Обзор», «Находки», «Карантин», «Исключения», «Расписание».
4. Пользователь открывает находку и читает evidence, counter-evidence, missing evidence, риск и причину доступных действий.
5. Пользователь выбирает «Переместить в карантин», «Исключить» или «Пропустить сейчас». Последнее — UI-only no-op текущей ревизии; «Исключить» сохраняет identity-based локальное правило.
6. Для «Переместить в карантин» `AlertDialog` показывает один объект, оценку размера, риск, последствия и условия восстановления, а затем перемещает объект в карантин.
7. Сервер повторно проверяет protected scope, policy и fingerprint, записывает durable manifest и выполняет same-volume atomic rename.
8. Пользователь может восстановить объект либо позже отдельно удалить навсегда один payload после нового preview.

Во время долгого аудита пользователь может выбрать «Отменить аудит». Частичные результаты остаются доступны для чтения, но любое mutation-действие требует нового завершённого аудита.

Визуальный прототип не является входом v0.1. Интерфейс описан компонентами и состояниями в архитектурном каноне.

## 7.2 Основные функции

### Read-only аудит

Сканирует как кандидаты только разрешённые user Library roots. Приложения, процессы, открытые файлы, автозапуск, receipts, shared/system sources и файловые метаданные используются как evidence. Системные объекты не становятся candidates и получают максимум `unsupported_manual`. Возвращается immutable revision и capability report.

### Отмена аудита

`audit_cancel` кооперативно останавливает adapters, фиксирует terminal state `cancelled` и обнуляет `allowedActions` в частичном отчёте. Повторный вызов идемпотентен.

### Объяснимая классификация

Named rules формируют метку, уровень уверенности, объяснение, контрдоказательства и недостающие сведения. Совпадения имени недостаточно: отдельно проверяются owner identity, installed state, active process, open files, receipt, dependencies, temporal evidence и data kind. LLM, скрытый score и непрозрачная модель не используются.

### Server-owned correlation identity

Adapters передают локальному resolver ephemeral typed claims о filesystem object, bundle/package/signing identity, owner, process/open-file target, receipt и dependency. Resolver создаёт отдельные subjects для Library cleanup-target и owner application, provenance, completeness certificates и immutable correlation revision. Только authoritative `remnant_of` из exact receipt payload, OS-owned container metadata или валидного installation-local signed process/open-file history создаёт owner binding. Path, basename, display name, bundle-ID-only и user attestation остаются hints.

Existence Library artifact и lifecycle owner app/executable вычисляются раздельно. Production inventory owner покрывает `/Applications`, `/System/Applications`, `~/Applications` и package-registered bundles; Spotlight только дополняет его. Receipt представлен lifecycle `live | stale | absent | unknown`. Positive counter-evidence блокирует действие независимо от полноты inventory. `absent` требует полного source scope и завершённого query в одной Snapshot A/B revision. Permission denial, capability gap, partial inventory, parse loss, ambiguity, missing/mismatch identity или изменение snapshot дают `unknown`/`staleDuringAudit` и пустые mutation actions.

### Server-only policy

`allowedActions` вычисляются независимо от классификации. Policy Engine сам выбирает versioned requirement profile и applicability `required | not_applicable | unsupported`; клиент их не передаёт. `not_applicable` не является `absent`, не создаёт certificate и не подавляет positive evidence.

Единственный actionable profile v0.1 — `private_regenerable_remnant_v1` для приватных регенерируемых `cache | log` с authoritative owner binding, доказанно отсутствующим owner/executable, полным required coverage, receipt `absent | stale`, отсутствующей активностью/uninstaller и безопасным data kind. Application Support, Containers/Group Containers, Preferences, WebKit/HTTPStorages, Saved State, databases, sync/VPN/personal/autostart остаются inspect-only. Risk-категория, `supportLevel`, protected scope, sensitivity flag, coverage gap, required `unknown`, `unsupported`, ambiguity/mismatch, активность, открытый файл, stale audit/correlation revision, ссылка или mount boundary блокируют действие.

### Protected scopes и безопасные метаданные

Встроенные server-side правила защищают универсальные классы: system scope, credential stores, browser profiles/cookies/passwords/bookmarks, user documents/projects/repositories/databases/saves, current project root, plugin-owned state и Codex state. `~/.codex` и локальные Git-проекты защищены независимо от пользовательских настроек. Персональные пути и названия приложений разработчика не входят в registry. JSON/YAML/plist преобразуются в безопасные metadata flags; сырые значения, секреты и subscription URLs не сохраняются и не показываются.

### Карточка находки и оценка места

Карточка показывает очищенное локальное имя верхнеуровневого компонента, категорию, logical/physical size, время последнего надёжного наблюдения, безопасное состояние owner binding, раздельные artifact/owner existence, активные процессы/open files, launch/background items, uninstaller, receipt lifecycle, requirement profile/applicability, признаки пользовательских данных, риск, причину и рекомендуемый способ удаления. Это имя доступно только widget и не передаётся модели; полный путь запрещён. Legacy target executable не участвует в action policy. `ReclaimEstimate` содержит snapshot-оценку physical bytes, confidence, basis и limitations; это не обещание изменения `df`.

### Постоянные исключения

«Исключить» создаёт локальный `UserExclusion` в user Application Support, вне репозитория и `~/.codex`. Схема версионируется, запись атомарна, права ограничены текущим пользователем. Match использует installation-keyed domain-separated digests полного rule/type/owner/bundle-package/signing/target claim set, а не строковый путь, имя, plain hash или публичную salt. Совпавший объект фильтруется до дорогого анализа и не получает destructive action token. Неизвестная schema, missing key или migration gap оставляют findings видимыми и блокируют tokens. Вкладка «Исключения» позволяет вернуть один объект в проверку и сбросить все правила только после подтверждения.

### Вкладка «Расписание» v0.1

Вкладка сохраняется как честный disabled/manual-run fallback. Она сообщает, что автоматический аудит не входит в v0.1, и запускает только обычный ручной `application_remnants` через существующий audit flow. `ScheduleIntent`/`ScheduleState` и tool skeleton могут присутствовать как инертная compatibility groundwork, но не создают intent с host side effect, automation, next/last scheduled run, cron, LaunchAgent или скрытый scheduler. Lifecycle и scheduled prompt перенесены в post-v0.1 CMC-13 и требуют отдельного owner decision.

### Карантин

Одна подтверждённая операция относится к одному объекту. До rename записывается manifest `prepared`; payload хранится по фиксированному серверному пути.

### Restore и purge

Restore не создаёт родителей, не перезаписывает существующий объект и возвращает payload только в исходный путь. Purge ручной, поэлементный, не следует ссылкам и не запускается по сроку.

### Quarantine Center и метрики

Вкладка «Карантин» показывает записи, физический размер, время, статус и причину блокировки. Сводка разделяет `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes` и `purgedPhysicalBytes`. `DiskObservation` отдельно показывает доступный и общий объём с временем наблюдения; ни одно поле не обещает точное изменение свободного места APFS. Все byte-значения UI представлены только в десятичных МБ/ГБ, включая явный `< 0,01 МБ` для малых ненулевых значений.

### Audit Dashboard

Тёмный React/Vite widget на shadcn/ui открывается сразу после `audit_start` и показывает пять вкладок — «Обзор», «Находки», «Карантин», «Исключения», «Расписание» — пять server-owned показателей, живую фазу и candidate counts, таблицу, `supportLevel`, safe evidence `Sheet`, coverage `Alert` и отдельные `AlertDialog` для действий. До завершения `revision=null`, findings/actions пусты. Widget получает только `SafeCorrelationView` и opaque action handles, не получает raw path/inventory/identity/graph/token и не вычисляет completeness или policy. Используются semantic tokens, `Tabs`, `Button`, `Tooltip` и автономный bundle без CDN. `unsupported_manual` содержит объяснение «Требует расширенного режима» без shell-команды. Dashboard остаётся `inline` по умолчанию; отдельная кнопка пользователя может запросить `fullscreen`, если Codex поддерживает этот режим. Режим `pip` продукт не предлагает. Отказ хоста не прерывает аудит. Гарантированное размещение в правой панели не входит в публичный контракт и не заявляется продуктом.

Адаптивный footer показывает копирайт Dzzen и фиксированные действия для публичного
репозитория, категории GitHub Ideas, сайта разработчика и будущей страницы поддержки.
Ссылки открываются только по клику через host `openExternal`; UI не вызывает для них
MCP tools и не добавляет audit data или tracking parameters. CSP разрешает только
redirect origins GitHub и dzzen.com, сохраняя внешние fetch/resources/frames закрытыми.

Большие аудиты не сокращают candidate discovery ради скорости. Global inventories, включая package inventory, переиспользуются между кандидатами в пределах Snapshot A/B, а candidate correlation выполняется с bounded concurrency восемь и детерминированным порядком результата. Эта граница рассчитана по двум Real-Mac тайм-аутам на 2 766 candidates; пятиминутный deadline и fail-closed `AUDIT_TIMEOUT` не меняются.

User LaunchAgent с доказанно отсутствующим абсолютным target показывается как `analysis_only` diagnostic, системный LaunchAgent/LaunchDaemon — как `unsupported_manual`. Они не входят в cleanup storage summary и имеют только `inspect`; disable, unload, quarantine, delete, shell и sudo отсутствуют. Активный user process с абсолютным executable, для которого получен точный `ENOENT`, также может отображаться как `analysis_only` diagnostic; PID и путь остаются server-only. Активный процесс или open file всегда является блокирующим контрдоказательством, а не автоматически доказанным «мусорным процессом», и не получает terminate/cleanup action.

## 7.3 Технологические ограничения

* TypeScript/Node.js MCP-сервер;
* React/Vite MCP App;
* JSON/NDJSON local store без базы данных; installation-keyed HMAC derivation для persisted identity;
* model-visible audit tools и app-only cleanup mutation tools;
* GitHub Releases и repository marketplace;
* Apache-2.0 до первого implementation commit.

## 7.4 Проверяемые предположения

* Разрешённых user-level API и утилит macOS 26 достаточно для полезного аудита без privileged helper.
* Понятные evidence и coverage gaps дают пользователю достаточно данных для поэлементного решения.
* Same-volume карантин внутри пользовательской области сохраняет нужные metadata и обеспечивает практичное восстановление.
* Repository marketplace может установить локальный filesystem MCP в целевом окружении без публикации в публичной Plugin Directory.

Каждое предположение проверяется отдельным automated test, clean-room check или real-Mac smoke. Неподтверждённое предположение не превращается в completion claim.

# 8. Релиз

## Этап 1 — foundation

Лицензия, workspace, platform guard, schemas, storage и model-visible MCP skeleton.

## Этап 2 — аудит и policy

Adapters, server-owned correlation resolver, evidence/coverage, classifier, server-only policy и path safety с deterministic, golden, property-based и contract tests.

## Этап 3 — обратимые действия и UI

Quarantine transaction, crash recovery, restore, purge, Dashboard, persistent exclusions и app-only actions.

## Этап 4 — упаковка и проверка

Plugin manifest, Skill, честный disabled/manual-run schedule fallback, clean-room установка, security/privacy suite, SBOM, provenance и real-Mac smoke.

## Состав v0.1

В релиз входят только `application_remnants`, read-only аудит с отменой, универсальные protected scopes, безопасные метаданные, evidence, inspect-only объяснения для всех Library categories и actionable `private_regenerable_remnant_v1` только для приватных cache/log, `unsupported_manual`, поэлементный quarantine/restore/purge, persistent exclusions, честный disabled/manual-run schedule fallback без automation, Quarantine Center, честные метрики размера и тёмный Dashboard без терминального workflow.

## После v0.1

Host-native monthly automation lifecycle и scheduled prompt, Browser/developer cleanup, on-device AI models, Service Worker CacheStorage, SDK/runtimes/package-manager caches, mutation в `/Library`, privileged helpers, drivers/daemons/frameworks, APFS/Time Machine management, другие audit profiles, публичная Plugin Directory, расширение платформ и любые privileged-компоненты рассматриваются только после v0.1 отдельным owner decision, исследованиями и ADR.

# Источники требований

* [Границы v0.1](../foundation/scope-and-principles.md)
* [Компоненты](../architecture/components.md)
* [MCP contract](../contracts/mcp-tools.md)
* [Модель безопасности](../safety/safety-model.md)
* [ADR-0010: полевой safety-контракт](../decisions/ADR-0010-field-research-safety-contract.md)
* [ADR-0011: публичный продукт, исключения и расписание](../decisions/ADR-0011-public-plugin-exclusions-scheduling.md)
* [ADR-0012: server-owned correlation identity](../decisions/ADR-0012-server-owned-correlation-identity.md)
* [ADR-0013: actionable Library remnants](../decisions/ADR-0013-actionable-library-remnant-correlation.md)
* [ADR-0014: host-native automation после v0.1](../decisions/ADR-0014-defer-host-automation-post-v01.md)
* [Correlation contract](../contracts/correlation-identity.md)
* [Критерии приёмки](../quality/acceptance-gates.md)
