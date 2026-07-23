---
type: Release Checklist
title: Release checklist Codex Mac Cleaner v0.1
description: Последовательная проверка готовности без автоматического release или ложных ручных отметок.
tags: [product, release, checklist, evidence]
status: approved
owner: Architect
date: 2026-07-19
---

# Правило использования

Этот список описывает будущую проверку. На этапе планирования все пункты считаются невыполненными. Выпуск, tag и публикация требуют отдельной команды владельца.

# Канон и лицензия

* [ ] OKF validator проходит на release commit.
* [ ] PRD, Issues и код не противоречат safety-инвариантам.
* [ ] Корневой `LICENSE` содержит официальный Apache-2.0.
* [ ] Package и artifact metadata указывают Apache-2.0.
* [ ] License compatibility зависимостей проверена; `NOTICE` создан только при фактической необходимости.

# Публичный репозиторий

* [ ] Community profile полон; support и private vulnerability reporting доступны по опубликованным ссылкам.
* [ ] `main` защищён ruleset без bypass: PR-only, squash-only, linear history, закрытые review threads и строгий required check `Контракты публичного репозитория`.
* [ ] Release tags защищены от update и deletion; tag и Release не созданы до отдельного разрешения владельца.
* [ ] Actions ограничены GitHub-owned actions с full-SHA pinning; default workflow token остаётся read-only.
* [ ] Dependabot alerts/security updates, secret scanning, push protection и CodeQL default setup подтверждены живыми GitHub API.

# Сборка и платформа

* [ ] Clean checkout собирает MCP server и автономный widget фиксированными командами.
* [ ] Runtime guard отклоняет macOS ниже 26, Intel и Rosetta до аудита.
* [ ] Release artifact не содержит x86_64 payload, debug secrets или абсолютные пути сборочной машины.

# Safety и recovery

* [ ] Contract, golden, property-based, fuzz, race и fault-injection tests проходят на final head SHA.
* [ ] Mutation не принимает path или destination.
* [ ] Universal protected registry исключает system/credential/browser-profile/personal/project/plugin/Codex scopes и локальные Git-проекты; персональных app/path rules нет.
* [ ] Совпадение имени без owner/activity/receipt/dependency/data-kind evidence не разрешает mutation.
* [ ] Library artifact и owner application представлены разными subjects; authoritative `remnant_of` доказан exact receipt payload, OS-owned metadata или валидной keyed process/open-file history.
* [ ] Production `~/Library/Caches|Logs` artifact проходит audit → `private_regenerable_remnant_v1` → prepare → move → restore; `.app`-fixture не подменяет этот gate.
* [ ] Application Support, Containers/Group Containers, Preferences, WebKit/HTTPStorages, Saved State, databases, sync/VPN/personal/autostart остаются inspect-only.
* [ ] `not_applicable` не подменяет `absent`/`unknown`, не создаёт certificate и не подавляет positive evidence; unsupported profile блокирует mutation.
* [ ] Quarantine использует durable `prepared` manifest и same-volume atomic rename.
* [ ] Restore не перезаписывает объект и сохраняет проверяемые metadata/xattrs.
* [ ] Purge ручной, поэлементный и не следует ссылкам.
* [ ] Повреждённый manifest блокирует destructive-tools.
* [ ] `audit_cancel` и race tests дают один terminal state; в `cancelled` нет `allowedActions`.
* [ ] Failed purge не скрывает payload и не меняет `purgedPhysicalBytes`.
* [ ] System/shared findings имеют `unsupported_manual` и не содержат mutation, `sudo` или готовой команды.
* [ ] Official uninstaller блокирует manual quarantine, когда он является рекомендуемым способом.
* [ ] Excluded finding не получает preview; path-only и изменившаяся identity не создают ложное совпадение.
* [ ] Unknown/corrupt exclusion schema не скрывает findings и блокирует destructive-token issuance.
* [ ] Candidate-specific installed/process/open-file/receipt/dependency facts получены server-owned resolver без path/name/display-only resolution.
* [ ] `absent` подтверждён completeness certificate полного same-snapshot query; partial/permission/capability/ambiguous/mismatch cases дают `unknown`.
* [ ] Snapshot A/B race выставляет `staleDuringAudit`, а token привязан к immutable correlation revision, owner-binding/profile fingerprints и хранится server-side.
* [ ] Exclusion store использует installation-keyed digests; plaintext identity, plain hash/public salt и неоднозначная migration не проходят gate.
* [ ] Model/widget/package/log/test/PR privacy scan не находит raw path, inventory, bundle/package/signing claims, historical owner bindings, correlation graph или token material.

# Privacy и UI

* [ ] Model-visible ответы, обычные логи, fixtures и PR evidence не содержат полных путей, паролей, токенов, subscription URLs или raw config values.
* [ ] Основной сценарий не выполняет сетевых запросов и не отправляет телеметрию.
* [ ] Dashboard работает без CDN и показывает coverage, риск и причины запрета не только цветом.
* [ ] Dashboard v4 имеет вкладки «Обзор», «Карантин», «Оставленные», «Автопроверка», компактную grouped-таблицу на «Обзоре» и не имеет bulk token.
* [ ] Последняя завершённая revision переживает restart в HMAC-protected atomic state; `null/null` ничего не сканирует, а mutation повторно валидируется.
* [ ] «Очистить карантин» подтверждает и очищает entries строго по одному и останавливается при частичной ошибке.
* [ ] Метрики приходят с сервера; отдельно показаны `candidateLogicalBytes`, `candidatePhysicalBytes`, quarantine/purge и timestamped `DiskObservation` без причинного APFS delta.
* [ ] «Пропустить сейчас» работает как session-local no-op; «Исключить» переживает перезапуск; «Переместить в карантин» перемещает только один объект.
* [ ] Exclusions поддерживают search/filter, «Снова проверять», удаление одной записи, подтверждаемый reset all и schema migrations.
* [ ] Вкладка «Расписание» v0.1 честно disabled, не показывает opt-in/lifecycle или next/last scheduled run и предлагает обычный ручной read-only audit.
* [ ] Инертные schedule schemas/intents не создают host action; `enabled=false`, automation ID отсутствует, cron, LaunchAgent и скрытый scheduler не создаются.
* [ ] Tabs, dialogs и actions проходят keyboard/focus tests.
* [ ] App-only mutation tools недоступны модели.

# Распространение

* [ ] `.codex-plugin/plugin.json`, `.mcp.json` и `SKILL.md` проходят проверки.
* [ ] Clean-room установка из repository marketplace воспроизведена.
* [ ] В новой задаче Codex аудит и Dashboard запускаются без копирования команды; решения выполняются только кнопками.
* [ ] Public package и clean-room evidence не заявляют scheduled prompt или host automation lifecycle как возможность v0.1.
* [ ] Public package scan не находит username, home paths, персональные app names/decisions или real-Mac inventory.
* [ ] SBOM, checksum и provenance связаны с tag и commit.
* [ ] Real-Mac smoke выполнен на macOS 26 Apple Silicon и приложен к тому же commit.
* [ ] Независимое review подтверждает specification compliance, code quality и evidence freshness.

# Ручные действия владельца

* [ ] Владелец отдельно разрешил release.
* [ ] Tag и GitHub Release созданы только после разрешения.
* [ ] Публичная Plugin Directory не заявлена и не используется в v0.1.
* [ ] Manual real-Mac smoke подтверждён владельцем отдельно от автоматических checks.
