---
type: Release Checklist
title: Незавершённый Real-Mac smoke protocol v0.1
description: Ручной owner gate для release SHA; документ не фиксирует выполненную проверку.
tags: [release, smoke, macos, manual, owner-gate]
status: planned
owner: Product Owner
date: 2026-07-20
---

# Статус

Протокол подготовлен, но не выполнялся. Ни один пункт ниже не является
подтверждением готовности, release, tag или публикации.

* Commit SHA:
* macOS:
* Hardware:
* FDA mode:
* Result: не выполнено
* Evidence:
* Проверяющий:
* Дата и время:

# Предусловия

- [ ] Указан review-approved release SHA без локальных изменений.
- [ ] Используется Apple Silicon с macOS 26 или новее.
- [ ] Подготовлены только синтетическое приложение и синтетические данные.
- [ ] Зафиксированы режимы с Full Disk Access и без него.
- [ ] Проверяющий подтвердил, что реальные пользовательские данные и cleanup-операции вне синтетического контура запрещены.

# Установка и clean-room

- [ ] Verify-only artifact соответствует checksum, SBOM и provenance того же SHA.
- [ ] Плагин установлен из repository/personal marketplace без терминала.
- [ ] В новой задаче Codex запущен обычный `application_remnants` audit и открыт Dashboard без копирования команд или сообщения «готово».
- [ ] Основной сценарий не создаёт сетевых запросов.

# Read-only аудит и защищённые области

- [ ] Аудит отдельно проверен с Full Disk Access и без него; coverage gaps отображаются честно.
- [ ] Secret-like synthetic fixture не появляется в model/widget/log/evidence output.
- [ ] `~/.codex`, current project root, plugin state и синтетический Git project не получают mutation preview.
- [ ] Credential, browser-profile, personal-data и system scopes не получают mutation preview.
- [ ] Finder reveal не изменяет объект.
- [ ] Отмена активного аудита оставляет просматриваемый partial report без действий.

# Поэлементные действия и восстановление

- [ ] «Пропустить сейчас» не вызывает tool и действует только для текущей ревизии.
- [ ] «Исключить» сохраняется после перезапуска, снимается через «Снова проверять» и не совпадает с заменённой identity.
- [ ] «Переместить в карантин» затрагивает ровно один синтетический объект.
- [ ] Restore возвращает объект без overwrite и сохраняет применимые metadata/xattrs.
- [ ] Purge затрагивает ровно одну запись после отдельного подтверждения.
- [ ] Инъекция ошибки purge сохраняет payload, manifest и прежний StorageSummary.
- [ ] Crash recovery приходит к однозначному состоянию либо блокирует mutation fail closed.

# Метрики и расписание

- [ ] Logical/physical/quarantine/purged metrics и DiskObservation обновляются без заявления причинного APFS delta.
- [ ] Вкладка «Расписание» показывает disabled/manual-run fallback.
- [ ] Ручной запуск использует обычный read-only audit.
- [ ] Automation ID, opt-in/lifecycle controls и next/last scheduled run отсутствуют.
- [ ] Cron, LaunchAgent, LaunchDaemon и hidden scheduler не создаются.

# Privacy и решение владельца

- [ ] Package privacy scan не находит username, home paths, personal app inventory, developer decisions, raw secrets, historical binding values или real-Mac inventory.
- [ ] Evidence содержит только безопасные команды, итоговые counts, SHA и package digests.
- [ ] Владелец отдельно зафиксировал итоговый result и ссылку на evidence.
- [ ] Tag не создан.
- [ ] GitHub Release не создан.
- [ ] Publication/deploy не выполнялись.

# Итог

* Result: не выполнено
* Blocking observations:
* Evidence links:
* Owner decision:
