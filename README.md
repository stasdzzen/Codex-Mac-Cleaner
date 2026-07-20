# Codex Mac Cleaner

[![Проверки репозитория](https://github.com/stasdzzen/Codex-Mac-Cleaner/actions/workflows/repository.yml/badge.svg?branch=main)](https://github.com/stasdzzen/Codex-Mac-Cleaner/actions/workflows/repository.yml)
![Платформа](https://img.shields.io/badge/macOS-26%2B-000000?logo=apple&logoColor=white)
![Архитектура](https://img.shields.io/badge/Apple%20Silicon-arm64-333333)
[![Лицензия](https://img.shields.io/badge/license-Apache--2.0-2ea44f)](LICENSE)

Публичный local-first плагин Codex для macOS 26 на Apple Silicon. Он без
терминального workflow проводит read-only аудит остатков обычных приложений,
объясняет доказательства и по одной кнопке перемещает разрешённый объект
в обратимый карантин.

> [!WARNING]
> `v0.1.0-beta.1` — публичная тестовая версия для проверки на синтетических
> данных. Автоматические security gates пройдены, но ручной Real-Mac smoke
> владельца ещё не завершён. Не используйте beta для очистки ценных данных.

## Установка beta-плагина

Требования: Codex с поддержкой команды `codex plugin`, macOS 26 или новее,
Apple Silicon `arm64` и Node.js `24.18.x`. Intel, Rosetta и старые версии macOS
не поддерживаются.

Один раз добавьте этот публичный репозиторий как marketplace, зафиксированный
на beta-теге, затем установите плагин:

```bash
codex plugin marketplace add stasdzzen/Codex-Mac-Cleaner --ref v0.1.0-beta.1
codex plugin add codex-mac-cleaner@codex-mac-cleaner
```

Проверьте, что плагин появился в списке:

```bash
codex plugin list
```

После установки откройте **новую задачу Codex** и напишите:

> Проверь остатки удалённых приложений и открой Audit Dashboard.

Дальше терминал не нужен: аудит запускается из Codex, а «Оставить»,
«Переместить в карантин», «Восстановить» и «Удалить навсегда» работают только
как отдельные кнопки для одного объекта. Плагин не выполняет массовую или
автоматическую очистку.

Если команда `codex plugin` отсутствует, обновите Codex до версии с поддержкой
плагинов. Публикации в общей Plugin Directory у этой beta пока нет.

## Безопасная модель

Универсальные protected classes, включая состояние Codex, текущий проект,
credential/browser-profile/personal data и локальные Git-проекты, проверяются
server-side. Персональные решения разработчика, содержимое реального Mac,
полные домашние пути и секреты в публичный bundle не входят.

Удаление исходника не выполняется напрямую: действие «Удалить» в v0.1 означает
отдельное подтверждение и перемещение одного объекта в собственный карантин.
Restore и окончательный purge остаются отдельными поэлементными действиями.

## Статус и платформа

`v0.1.0-beta.1` включает runtime-пакеты, Audit Dashboard, автоматические
security/privacy/contract gates и deterministic package evidence. Beta не
является финальной v0.1: ручной Real-Mac smoke и итоговое решение владельца
остаются открытыми gates.

Host-native monthly automation не входит в v0.1. Будущая вкладка «Расписание»
сохраняется только как честный disabled/manual-run fallback; продукт не создаёт
cron, LaunchAgent или скрытый scheduler.

## Beta release и проверка артефакта

`node scripts/package-release.mjs --verify-only` дважды собирает production
plugin во временных каталогах, сравнивает file list и content hashes, проверяет
privacy boundary и формирует deterministic tar, SHA-256, CycloneDX SBOM и
unsigned provenance. Verify-only режим не записывает artifact в репозиторий.
Публичный prerelease содержит tar-архив и SHA-256; SBOM и provenance находятся
внутри архива и связаны с release commit.

См. [заметки к v0.1.0-beta.1](docs/release/v0.1.0-beta.1.md).

Ручная проверка описана в [незаполненном Real-Mac smoke
protocol](docs/release/real-mac-smoke.md). Пока владелец не выполнит его на
release SHA, beta не должна считаться готовой к работе с ценными данными.

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
