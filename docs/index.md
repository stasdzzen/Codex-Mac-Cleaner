# Codex Mac Cleaner — архитектурный канон

Этот каталог — OKF bundle с утверждённой архитектурой Codex Mac Cleaner. Документы предназначены для людей и агентов: каждый концепт хранится в отдельном Markdown-файле с YAML frontmatter, а `index.md` задаёт порядок чтения.

# Быстрый вход

* [Основания](foundation/) — исходная идея, границы MVP, принципы и терминология.
* [Архитектура](architecture/) — системный контекст, компоненты и основные потоки.
* [Контракты](contracts/) — доменная модель, server-owned correlation identity, MCP-tools, карантин и ошибки.
* [Безопасность](safety/) — safety model, threat model и политика путей.
* [Решения](decisions/) — принятые ADR.
* [Качество](quality/) — стратегия тестирования и release gates.
* [Продукт](product/) — PRD, roadmap, трассировка требований и release scope.
* [Спецификации дизайна](superpowers/specs/) — утверждённые на обсуждении дополнения перед изменением канона.
* [Планы реализации](superpowers/plans/) — пошаговый TDD-план для Issues.
* [Промпты](prompts/) — готовые входы для отдельных Workers.
* [Разработка](development/) — контракт Issue → task → worktree → PR.
* [Передача Product-чату](handoff/) — утверждённый вход для PRD, промптов и GitHub Issues.

# Статус

Архитектурный пакет утверждён 15 июля 2026 года и дополнен ADR-0009, ADR-0010 и ADR-0011 от 17 июля, ADR-0012 и ADR-0013 от 18 июля, ADR-0014 от 19 июля, ADR-0015 от 21 июля, ADR-0016, ADR-0017 и ADR-0018 от 22 июля, ADR-0019 от 23 июля 2026 года. ADR-0011 заменяет персональные protected-правила универсальными классами публичного продукта и добавляет persistent exclusions. ADR-0012 вводит server-owned correlation identity, доказуемую полноту negative evidence и privacy-safe local derivation. ADR-0013 отделяет Library-артефакт от owner application и ограничивает actionable v0.1 доказуемо связанными private cache/log remnants. ADR-0014 переносит host-native automation lifecycle после v0.1. ADR-0015 открывает безопасный Dashboard v2 сразу после старта, вводит server-owned пофазный прогресс и shared global inventories A/B без ослабления coverage или mutation policy. ADR-0016 удаляет режим PiP из Dashboard и сохраняет только явный пользовательский fullscreen-запрос. ADR-0017 добавляет host-mediated footer-ссылки с закрытым GitHub/dzzen redirect allowlist без внешних fetch и telemetry. ADR-0018 фиксирует измеренную concurrency восемь, читаемые МБ/ГБ и безопасную read-only диагностику missing-target автозапуска без расширения mutation scope. ADR-0019 отменяет общий автоматический deadline аудита: сервер обрабатывает все найденные кандидаты, а остановка всего запуска возможна только по явной отмене пользователя или реальной внутренней ошибке. Product-документы, планы, промпты и GitHub Issues являются производными артефактами и не могут менять архитектурный канон.
