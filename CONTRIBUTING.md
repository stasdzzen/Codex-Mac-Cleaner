# Участие в разработке

Спасибо за вклад в Codex Mac Cleaner. Проект принимает небольшие проверяемые
изменения с явной связью между проблемой, каноном и результатом.

## Перед началом

1. Прочитайте [`AGENTS.md`](AGENTS.md), [архитектурный канон](docs/index.md) и
   [контракт выполнения](docs/development/execution-contract.md).
2. Найдите существующую [Issue](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues)
   или создайте сообщение об ошибке либо ограниченное предложение через Issue Forms.
3. Согласуйте scope до архитектурных, security, migration или release-изменений.

Не публикуйте уязвимости в Issue или Pull Request. Для них действует закрытый
порядок из [SECURITY.md](SECURITY.md).

## Поддерживаемая среда

Целевой продукт поддерживает только macOS 26+ на Apple Silicon `arm64`.
Repository gate требует Python 3 из стандартного GitHub runner и не является
runtime-зависимостью продукта. После появления TypeScript workspace применяются
версии и команды, зафиксированные каноном и lockfile.

## Рабочий порядок

1. Одна Issue ведёт к одной задаче, одному worktree, одной ветке и одному PR.
2. Не расширяйте scope и не меняйте архитектурный канон без ADR.
3. Для нового поведения используйте RED → GREEN → refactor.
4. Не тестируйте очистку на реальном Mac: используйте синтетические fixtures и
   отдельный owner-gated smoke только там, где это разрешено каноном.
5. Не добавляйте secrets, полные домашние пути, реальный app inventory,
   персональные данные, telemetry или необработанные конфигурации.
6. Пишите commits, PR, review и GitHub-комментарии по-русски.

## Проверки

До Pull Request выполните:

```bash
python3 .github/scripts/validate_repository.py
python3 -m unittest discover -s tests -p 'test_repository_policy.py' -v
git diff --check
```

После создания runtime workspace дополнительно обязателен root `pnpm check`.
Focused tests не заменяют полный gate.

## Pull Request

* свяжите PR с Issue через `Closes #...`;
* перечислите изменения и точные команды проверок;
* укажите риски, ограничения и owner-only gates;
* не смешивайте несвязанные исправления;
* не отмечайте merge, release или ручной smoke выполненными заранее.

Шаблон Pull Request содержит обязательный checklist. Self-reported `PASS` не
заменяет GitHub Actions и проверку текущего head SHA.

## Release

Release, tag, notarization и публикация плагина выполняются только после
отдельного подтверждения владельца и прохождения release checklist. Обычный PR
не создаёт tag и не меняет опубликованный channel.
