# Codex Mac Cleaner

[![Проверки репозитория](https://github.com/stasdzzen/Codex-Mac-Cleaner/actions/workflows/repository.yml/badge.svg?branch=main)](https://github.com/stasdzzen/Codex-Mac-Cleaner/actions/workflows/repository.yml)
![Платформа](https://img.shields.io/badge/macOS-26%2B-000000?logo=apple&logoColor=white)
![Архитектура](https://img.shields.io/badge/Apple%20Silicon-arm64-333333)
[![Лицензия](https://img.shields.io/badge/license-Apache--2.0-2ea44f)](LICENSE)

Публичный local-first плагин Codex для macOS 26 на Apple Silicon. Он без
терминального workflow проводит read-only аудит остатков обычных приложений,
объясняет доказательства и по одной кнопке перемещает разрешённый объект
в обратимый карантин.

> [!IMPORTANT]
> Репозиторий содержит утверждённый канон, runtime-пакеты и автоматические
> тесты, но публичного Release пока нет. Реализация не считается готовой к
> выпуску до CMC-10, независимого review и незавершённых owner gates.

## Безопасная модель

Универсальные protected classes, включая состояние Codex, текущий проект,
credential/browser-profile/personal data и локальные Git-проекты, проверяются
server-side. Персональные решения разработчика, содержимое реального Mac,
полные домашние пути и секреты в публичный bundle не входят.

Удаление исходника не выполняется напрямую: действие «Удалить» в v0.1 означает
отдельное подтверждение и перемещение одного объекта в собственный карантин.
Restore и окончательный purge остаются отдельными поэлементными действиями.

## Статус и платформа

Архитектура, Product-пакет, runtime-пакеты, тесты, Worker-промпты и GitHub
Issues созданы. v0.1 ещё не прошла финальную CMC-10 и не выпущена.

Host-native monthly automation не входит в v0.1. Будущая вкладка «Расписание»
сохраняется только как честный disabled/manual-run fallback; продукт не создаёт
cron, LaunchAgent или скрытый scheduler.

Целевая платформа:

* macOS 26 и новее;
* только Apple Silicon `arm64`;
* без Intel, Rosetta и старых macOS.

## Документация

* [Архитектурный канон](docs/index.md)
* [Границы v0.1](docs/foundation/scope-and-principles.md)
* [Модель безопасности](docs/safety/safety-model.md)
* [Политика публичного репозитория](docs/development/public-repository-policy.md)
* [PRD](docs/product/PRD-codex-mac-cleaner.md)
* [План реализации](docs/superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md)
* [Промпты для Workers](docs/prompts/)
* [Контракт выполнения](docs/development/execution-contract.md)

## Участие и поддержка

Перед вкладом прочитайте [CONTRIBUTING.md](CONTRIBUTING.md) и выберите одну
GitHub Issue. Воспроизводимые ошибки отправляйте через Bug Issue Form,
ограниченные предложения — через Feature Issue Form. Вопросы маршрутизируются
по [SUPPORT.md](SUPPORT.md).

Не публикуйте сведения об уязвимостях в Issue или Pull Request. Используйте
[Private vulnerability reporting](https://github.com/stasdzzen/Codex-Mac-Cleaner/security/advisories/new)
и правила из [SECURITY.md](SECURITY.md).

Проект находится в ранней alpha-стадии и не предоставляет SLA.

## Оркестрация

Одна Issue соответствует одной задаче, одному worktree, одной ветке и одному
Pull Request. `main` защищён GitHub ruleset и принимает изменения только через
PR с обязательным repository gate. Release, tag и публикация требуют отдельного
решения владельца.

## Лицензия

Проект распространяется по Apache License 2.0. Полный текст находится в
[LICENSE](LICENSE).
