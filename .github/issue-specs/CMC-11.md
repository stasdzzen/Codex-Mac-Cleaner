```cto-issue
schema: 1
dependencies: none
conflicts: none
touched_paths: docs/; .github/issue-specs/; README.md
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Replace owner-specific cleanup decisions with a public, universal and local-first product contract before implementation starts.

### Scope

Create the approved architecture delta and intended-vs-implemented gap matrix; supersede the personalized parts of ADR-0010 through ADR-0011; update PRD, architecture, safety, MCP/UI contracts, quality gates, roadmap, traceability, prompts and Issue specs; add dependency-aware implementation Issues for persistent exclusions, capability-aware monthly scheduling and explicitly deferred detector profiles.

### Acceptance criteria

The canonical bundle contains no personal application allowlist/denylist, owner path, username or real-Mac inventory. Universal protected classes, per-finding Delete/Exclude/Skip-now semantics, versioned local exclusion state, identity mismatch handling, an Exclusions tab, a native-Codex-automation intent bridge with honest fallback, public-bundle privacy checks and the v0.1/v0.2 boundary are explicit and testable. Existing safety invariants are not weakened. New and updated live GitHub Issues exactly match their local specs and preserve dependency order.

### Verification

Run Markdown/OKF checks, link and placeholder validation, the configured CTO Issue validators for all local specs, exact local/live Issue body comparison and `git diff --check` on the final head SHA.

### Constraints

Documentation and backlog only. Do not implement runtime code, write directly to main, interrupt Workers, merge, tag, release, publish the plugin, create a privileged helper or mutate the real Mac.

## Русский

### Цель

До начала реализации заменить персональные решения владельца универсальным публичным и local-first контрактом продукта.

### Объём

Оформить утверждённую архитектурную дельту и intended-vs-implemented gap matrix; ADR-0011 заменить персонализированные части ADR-0010; обновить PRD, архитектуру, safety, MCP/UI-контракты, quality gates, roadmap, traceability, промпты и Issue-спеки; добавить зависимые implementation Issues для постоянных исключений, capability-aware ежемесячного расписания и явно отложенных detector profiles.

### Критерии приёмки

В каноне нет персонального списка приложений, пути владельца, username или real-Mac inventory. Универсальные protected-классы, поэлементные действия «Удалить»/«Исключить»/«Пропустить сейчас», версионируемое локальное состояние исключений, обработка несовпадения identity, вкладка «Исключения», intent bridge к нативной Codex automation с честным fallback, privacy-проверки публичного bundle и граница v0.1/v0.2 описаны точно и проверяемо. Существующие safety-инварианты не ослаблены. Новые и обновлённые живые GitHub Issues точно совпадают с локальными спеками и сохраняют порядок зависимостей.

### Проверка

Запустить Markdown/OKF, link и placeholder checks, настроенные CTO Issue validators для всех локальных спецификаций, точное сравнение локальных и живых тел Issues и `git diff --check` на финальном head SHA.

### Ограничения

Только документация и backlog. Не реализовывать runtime-код, не писать напрямую в main, не прерывать Workers, не выполнять merge, tag, release, публикацию плагина, создание privileged helper или изменения реального Mac.
