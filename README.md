# Codex Mac Cleaner

Публичный local-first Codex-плагин для macOS 26 на Apple Silicon. Он без терминального workflow проводит read-only аудит остатков обычных приложений, объясняет доказательства и по одной кнопке перемещает разрешённый объект в обратимый карантин. Универсальные protected classes, включая состояние Codex, текущий проект, credential/browser-profile/personal data и локальные Git-проекты, проверяются server-side; персональные решения разработчика в bundle не входят.

## Статус

Архитектура, Product-пакет, TDD-план, Worker-промпты и GitHub Issues подготовлены для отдельного Controller. Runtime-кода пока нет.

Целевая платформа:

* macOS 26 и новее;
* только Apple Silicon `arm64`;
* без Intel, Rosetta и старых macOS.

## Документация

* [Архитектурный канон](docs/index.md)
* [Границы v0.1](docs/foundation/scope-and-principles.md)
* [Модель безопасности](docs/safety/safety-model.md)
* [Полевой safety-контракт](docs/superpowers/specs/2026-07-17-field-research-safety-contract-design.md)
* [PRD](docs/product/PRD-codex-mac-cleaner.md)
* [План реализации](docs/superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md)
* [Промпты для Workers](docs/prompts/)
* [Контракт выполнения](docs/development/execution-contract.md)

## Оркестрация

Репозиторий подготовлен для issues-mode навыка `$codex-cto-orchestrator`. Наличие конфигурации не активирует Controller. Для Controller нужна новая постоянная задача, явно назначенная пользователем этому репозиторию.

## Лицензия

Архитектурно утверждена Apache-2.0. Текущий MIT `LICENSE` остаётся временным несоответствием до отдельной юридически защищённой Issue `CMC-01`; реализация до её закрытия запрещена.
