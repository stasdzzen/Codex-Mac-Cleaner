---
type: ADR
title: "ADR-0018: пропускная способность Real-Mac аудита и безопасная диагностика автозапуска"
description: Измеренная concurrency восемь, читаемые единицы Dashboard и read-only missing-target diagnostics без расширения mutation scope.
tags: [adr, audit, performance, dashboard, autostart, privacy]
status: approved
owner: Architect
date: 2026-07-22
---

# Контекст

Real-Mac проверка `v0.1.0-beta.6` дважды не завершилась в пределах установленного
пятиминутного deadline. Первый запуск обработал 2 044 из 2 766 кандидатов, повторный
— 2 016 из 2 766; оба завершились `AUDIT_TIMEOUT` без actionable revision.
Глобальный package inventory уже переиспользовался в Snapshot A/B, поэтому
оставшимся ограничением стала фиксированная candidate concurrency четыре.

По худшему наблюдаемому запуску средняя занятость одного worker составляет около
596 мс на кандидата. Для 2 766 кандидатов граница четыре требует примерно 412 секунд,
а граница восемь — около 206 секунд до учёта общего overhead. Увеличивать deadline,
обрезать discovery или пропускать candidate-specific A/B-проверки нельзя.

Первоначальная продуктовая идея также включает следы удалённых приложений в
LaunchAgents/LaunchDaemons и оставшиеся background-компоненты. Runtime имел общие
autostart adapters, но production facade возвращал для них пустой источник. При этом
имя реального компонента полезно человеку в Dashboard, хотя передавать модели полный
путь или локальный inventory запрещено. Byte-значения в интерфейсе были техническими
и плохо читаемыми.

# Решение

1. Production runtime использует фиксированную bounded concurrency восемь для
   candidate correlation. Порядок findings остаётся порядком discovery, все workers
   получают общий cancellation signal.
2. Server-owned deadline остаётся равным пяти минутам. Глобальный package inventory
   снимается не более одного раза на фазу A/B, а candidate-specific
   `pkgutil --file-info` выполняется для каждого кандидата в обеих фазах.
3. Dashboard отображает byte-метрики в десятичных МБ или ГБ с максимум двумя
   знаками после запятой. Значение меньше 0,01 МБ показывается как `< 0,01 МБ`;
   ноль — как `0 МБ`. Семантика logical/physical/quarantine/purged/disk не меняется.
4. Model-visible finding сохраняет generic safe label. Только widget-only `_meta`
   может содержать очищенное имя одного верхнеуровневого компонента без directory
   chain. Полный путь, app inventory, bundle/package/signing identity, raw plist и
   secret-like values запрещены в обоих каналах.
5. User LaunchAgent с абсолютным отсутствующим `Program` либо первым элементом
   `ProgramArguments` становится `analysis_only` diagnostic с единственным действием
   `inspect`. Системный LaunchAgent/LaunchDaemon с таким missing target становится
   `unsupported_manual`; это покрывает и daemon, указывающий на отсутствующий helper.
   Отдельный helper без authoritative launch relation по имени не классифицируется.
6. Autostart diagnostics не участвуют в cleanup storage summary, owner binding и
   mutation policy. Они не получают quarantine/delete/disable/shell/sudo actions.
   Неразбираемый plist, относительный target, permission gap или неизвестное состояние
   не превращаются в missing-target finding.
7. Активный процесс или открытый файл остаётся positive blocking counter-evidence.
   Если `ps` сообщает абсолютный executable активного процесса, а filesystem
   возвращает точный `ENOENT`, user process может быть показан как `analysis_only`
   diagnostic, а процесс другого OS owner — как `unsupported_manual`. Имя доступно
   только widget, PID и полный путь не выводятся. Такой процесс не называется
   мусором и не получает terminate, quarantine, delete или shell action.

# Safety-инварианты

Решение не меняет protected scopes, authoritative owner binding,
`private_regenerable_remnant_v1`, Snapshot A/B, completeness certificates,
поэлементный quarantine, restore/purge или отсутствие системных mutation в v0.1.
Ошибка deadline по-прежнему не создаёт revision. Системный autostart читается только
для диагностики; runtime не выгружает процесс, не отключает plist и не удаляет helper.

# Последствия

* Измеренная Real-Mac нагрузка получает запас в прежнем deadline без потери
  кандидатов или evidence.
* Dashboard показывает понятные единицы и локально различимые компоненты, сохраняя
  более узкую model-visible форму.
* Осиротевшая запись автозапуска становится видимой, но остаётся безопасным ручным
  диагностическим сигналом, а не автоматически доказанным мусором.
* Owner Real-Mac smoke на установленном plugin bundle остаётся обязательным gate:
  расчёт throughput является детерминированной regression, а не заменой реального
  запуска.

# Связанные концепты

* [ADR-0010](ADR-0010-field-research-safety-contract.md)
* [ADR-0015](ADR-0015-live-audit-dashboard-and-shared-inventories.md)
* [Runtime flows](../architecture/runtime-flows.md)
* [Модель безопасности](../safety/safety-model.md)
