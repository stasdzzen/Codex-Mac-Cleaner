```cto-issue
schema: 1
dependencies: #50
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; scripts/; skills/; tests/plugin/; tests/security/; docs/development/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Let an installed Codex Mac Cleaner update between immutable release tags from one explicit chat or shell command without requiring the user to remove the plugin manually.

### Scope

Add a packaged update skill and a Node updater command. The updater accepts one exact release tag, validates the installed plugin and canonical Git marketplace identity, verifies that the remote tag exists, replaces the pinned marketplace ref only through Codex CLI commands, reinstalls the plugin cache and verifies the resulting version. Add rollback to the previous ref when add or reinstall fails. Package the updater and skill, document the command and add isolated fake-CODEX_HOME tests.

### Acceptance criteria

The chat request “update Codex Mac Cleaner to vX.Y.Z…” routes to the update skill only after explicit user intent. The updater never calls plugin remove, never edits config.toml or marketplace.json directly, never touches scanned files and accepts no arbitrary repository or marketplace name. A successful run changes the pinned ref and installed version. Failed target add or reinstall restores the previous marketplace ref and plugin version, or reports a blocking rollback failure. The user is told to restart Codex and open a new task.

### Verification

Run updater success, already-current, invalid-tag, wrong-source, target-add failure and reinstall-failure tests in isolated temporary CODEX_HOME fixtures. Run plugin/package freshness, security/privacy, deterministic package, full pnpm check, repository validator, policy tests and diff checks on the final head. Require independent review and green PR CI.

### Constraints

Do not add self-update to cleaner MCP runtime or mutation tools. Do not auto-select latest, auto-update, edit Codex config files directly, remove the installed plugin, use sudo, install a scheduler, touch user audit targets or publish a new release in this Issue.

## Русский

### Цель

Позволить установленному Codex Mac Cleaner обновляться между неизменяемыми release-тегами по одной явной команде в чате или shell без ручного удаления плагина пользователем.

### Объём

Добавить packaged update-skill и Node-команду обновления. Updater принимает один точный release-тег, проверяет установленный plugin и каноническую identity Git marketplace, подтверждает существование удалённого тега, заменяет pinned marketplace ref только командами Codex CLI, переустанавливает plugin cache и проверяет итоговую версию. При ошибке add или reinstall добавить rollback на предыдущий ref. Включить updater и skill в пакет, описать команду и добавить изолированные тесты с fake CODEX_HOME.

### Критерии приёмки

Запрос в чате «обнови Codex Mac Cleaner до vX.Y.Z…» маршрутизируется в update-skill только после явного намерения пользователя. Updater никогда не вызывает plugin remove, не редактирует config.toml или marketplace.json напрямую, не касается сканируемых файлов и не принимает произвольный repository или marketplace name. Успешный запуск меняет pinned ref и установленную версию. Ошибка добавления target ref или reinstall восстанавливает прежний marketplace ref и plugin version либо сообщает blocking rollback failure. Пользователь получает указание полностью перезапустить Codex и открыть новую задачу.

### Проверка

В изолированных temporary CODEX_HOME fixtures проверить success, already-current, invalid tag, wrong source, target-add failure и reinstall failure. Запустить plugin/package freshness, security/privacy, deterministic package, полный pnpm check, repository validator, policy tests и diff checks на финальном head. Потребовать независимую проверку и зелёный PR CI.

### Ограничения

Не добавлять self-update в cleaner MCP runtime или mutation tools. Не выбирать latest автоматически, не выполнять auto-update, не редактировать файлы конфигурации Codex напрямую, не удалять установленный plugin, не использовать sudo, не добавлять scheduler, не касаться audit targets пользователя и не выпускать новую версию в этой Issue.
