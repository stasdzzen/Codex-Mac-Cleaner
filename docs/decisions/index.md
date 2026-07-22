# Архитектурные решения

Принятые решения, которые нельзя менять неявно в PRD или реализации.

## ADR

* [ADR-0001: macOS 26 и Apple Silicon](ADR-0001-target-platform.md)
* [ADR-0002: TypeScript/Node.js runtime](ADR-0002-typescript-runtime.md)
* [ADR-0003: OKF для документации](ADR-0003-okf-documentation.md)
* [ADR-0004: узкий scope v0.1](ADR-0004-v01-scope.md)
* [ADR-0005: файловое хранилище без базы данных](ADR-0005-file-storage.md)
* [ADR-0006: тёмный Audit Dashboard на shadcn/ui](ADR-0006-dark-shadcn-dashboard.md)
* [ADR-0007: GitHub Releases и repository marketplace](ADR-0007-github-distribution.md)
* [ADR-0008: Apache License 2.0](ADR-0008-apache-license.md)
* [ADR-0009: safety/UX-дополнения v0.1](ADR-0009-v01-safety-ux-completion.md)
* [ADR-0010: protected scopes, inspection-only sources и наблюдаемые метрики диска](ADR-0010-field-research-safety-contract.md)
* [ADR-0011: публичный продукт, пользовательские исключения и Codex-расписание](ADR-0011-public-plugin-exclusions-scheduling.md)
* [ADR-0012: server-owned correlation identity и доказуемое отсутствие](ADR-0012-server-owned-correlation-identity.md)
* [ADR-0013: actionable correlation для остатков в user Library](ADR-0013-actionable-library-remnant-correlation.md)
* [ADR-0014: host-native automation после v0.1](ADR-0014-defer-host-automation-post-v01.md)
* [ADR-0015: живой Dashboard и shared inventories аудита](ADR-0015-live-audit-dashboard-and-shared-inventories.md)
* [ADR-0016: только fullscreen для расширенного отображения Dashboard](ADR-0016-fullscreen-only-dashboard-display.md)
* [ADR-0017: подвал Dashboard и host-mediated ссылки проекта](ADR-0017-dashboard-community-footer.md)

## Правило изменения

Новое решение не редактирует историю принятого ADR. Оно получает следующий номер, ссылается на заменяемый документ и явно описывает миграцию.
