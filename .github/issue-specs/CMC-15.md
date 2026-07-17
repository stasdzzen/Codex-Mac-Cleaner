```cto-issue
schema: 1
dependencies: #10
conflicts: none
touched_paths: docs/superpowers/specs/; docs/decisions/; docs/safety/; docs/product/
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Research separate Browser Storage and Developer Storage v0.2 profiles without expanding `application_remnants`.

### Scope

After explicit owner approval, produce detector/data-class matrices, threat models, policy boundaries, recovery expectations, ADR proposals and atomic future Issue slices for browser caches/models and developer runtimes/caches.

### Acceptance criteria

Research separates on-device AI models, ordinary browser caches and Service Worker offline data from protected profiles/cookies/passwords/bookmarks. It separately models SDKs, runtimes, package-manager caches, duplicate versions and consumer Android emulators versus Android SDK. Active/open caches remain blocked. No runtime scan or mutation is included.

### Verification

Run documentation/OKF/link checks and independent architecture/privacy review on the final docs SHA.

### Constraints

Remain `cto:blocked` until CMC-10 is closed and the owner explicitly opens new profiles. No runtime code, personal-profile scan, active-cache deletion, silent v0.1 expansion, merge or release.

## Русский

### Цель

Исследовать отдельные профили Browser Storage и Developer Storage v0.2 без расширения `application_remnants`.

### Объём

После явного owner approval подготовить detector/data-class matrices, threat models, policy boundaries, recovery expectations, ADR proposals и атомарные будущие Issue slices для browser caches/models и developer runtimes/caches.

### Критерии приёмки

Research отделяет on-device AI models, обычные browser caches и Service Worker offline data от защищённых profiles/cookies/passwords/bookmarks. Отдельно моделируются SDK, runtimes, package-manager caches, duplicate versions и consumer Android emulators против Android SDK. Active/open caches остаются blocked. Runtime scan и mutation отсутствуют.

### Проверка

Запустить documentation/OKF/link checks и независимый architecture/privacy review на финальном docs SHA.

### Ограничения

Оставаться `cto:blocked` до закрытия CMC-10 и явного открытия новых профилей владельцем. Запрещены runtime-код, scan personal profiles, удаление active cache, скрытое расширение v0.1, merge и release.
