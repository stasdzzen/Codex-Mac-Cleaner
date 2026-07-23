```cto-issue
schema: 1
dependencies: #82
conflicts: none
touched_paths: .github/issue-specs/CMC-44.md; package.json; pnpm-workspace.yaml; pnpm-lock.yaml; .codex-plugin/package-allowlist.json; .codex-plugin/runtime/server.js; docs/release/third-party-notices.json; docs/product/requirements-traceability.md; tests/security/; tests/plugin/
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Remove the two open runtime dependency vulnerabilities before packaging v0.1.0-beta.10.

### Scope

Resolve `fast-uri` GHSA-v2hh-gcrm-f6hx at a patched version of at least 3.1.4 and `@hono/node-server` GHSA-frvp-7c67-39w9 at a patched version of at least 2.0.5. Use the smallest reviewable lockfile or package-manager override change compatible with the current MCP SDK. Rebuild the checked-in plugin runtime and generated dependency/license metadata. Add supply-chain regressions that fail when either vulnerable version returns. Synchronize requirements traceability.

### Acceptance criteria

`pnpm why fast-uri -r` resolves only patched versions. `pnpm why @hono/node-server -r` resolves only patched versions. Production audit at severity moderate reports neither advisory. The packaged stdio MCP runtime, plugin contract, deterministic package and clean-room startup remain unchanged in behavior. GitHub Dependabot alerts for both advisories become resolved after merge. No alert is dismissed or ignored.

### Verification

Run root `pnpm check`, plugin/security suites, explicit `pnpm audit --prod --audit-level moderate`, dependency-resolution assertions, MCP/plugin builds, deterministic package verification, repository validators and `git diff --check`. Require all Pull Request checks and CodeQL green. Independently review the exact final head before merge.

### Constraints

Do not change product behavior, MCP tool schemas, safety policy, classifier or mutation authority. Do not bump the plugin release version, create a tag or publish a release. Do not dismiss Dependabot alerts, add audit exceptions or remove security checks. Do not reinstall the owner's plugin, run a real-Mac audit or clean the Mac. If the patched Hono major version is incompatible with the current MCP SDK, stop and report the exact incompatibility instead of weakening the gate.

## Русский

### Цель

Устранить две открытые runtime-уязвимости зависимостей до сборки v0.1.0-beta.10.

### Объём

Закрыть `fast-uri` GHSA-v2hh-gcrm-f6hx версией не ниже исправленной 3.1.4 и `@hono/node-server` GHSA-frvp-7c67-39w9 версией не ниже исправленной 2.0.5. Использовать минимальное проверяемое изменение lockfile или package-manager override, совместимое с текущим MCP SDK. Пересобрать отслеживаемый runtime плагина и генерируемые сведения о зависимостях и лицензиях. Добавить supply-chain регрессии, которые падают при возврате любой уязвимой версии. Синхронизировать матрицу требований.

### Критерии приёмки

`pnpm why fast-uri -r` разрешает только исправленные версии. `pnpm why @hono/node-server -r` разрешает только исправленные версии. Production-аудит зависимостей с порогом moderate не находит обе указанные уязвимости. Упакованный stdio MCP runtime, plugin contract, детерминированный пакет и clean-room запуск не меняют поведение. После merge оба Dependabot alert переходят в resolved. Ни один alert не закрывается вручную и не игнорируется.

### Проверка

Запустить корневой `pnpm check`, наборы plugin/security, явный `pnpm audit --prod --audit-level moderate`, проверки разрешённых версий зависимостей, сборки MCP/plugin, проверку воспроизводимого пакета, валидаторы репозитория и `git diff --check`. Потребовать зелёные Pull Request checks и CodeQL. До merge независимо проверить точный финальный head.

### Ограничения

Не менять поведение продукта, схемы MCP-инструментов, правила безопасности, classifier и полномочия mutation. Не повышать версию плагина, не создавать тег и не публиковать выпуск. Не закрывать Dependabot alerts вручную, не добавлять исключения аудита и не удалять security-проверки. Не переустанавливать плагин владельца, не запускать реальный аудит Mac и не очищать Mac. Если исправленная major-версия Hono несовместима с текущим MCP SDK, остановиться и показать точную несовместимость, а не ослаблять gate.

