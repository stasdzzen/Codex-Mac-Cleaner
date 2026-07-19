# История архитектурного канона

## 2026-07-19

* **Граница v0.1**: ADR-0014 перенёс создание/update/pause/resume/delete host-native Codex automation и scheduled prompt в capability-релиз после v0.1.
* **Честный fallback**: schedule schemas/intents и вкладка «Расписание» остаются только инертной compatibility groundwork; v0.1 предлагает ручной read-only audit и не создаёт automation, cron, LaunchAgent или скрытый scheduler.
* **Очередь**: CMC-10 больше не зависит от CMC-13; CMC-13 зависит от CMC-10 и заблокирована до отдельного owner decision.

## 2026-07-18

* **Actionable Library remnants**: CMC-22/ADR-0013 разделил Library artifact и owner application, ввёл authoritative `remnant_of`, receipt lifecycle и server-owned requirement profiles; в v0.1 actionable только приватные регенерируемые cache/log, остальные категории inspect-only.
* **Recovery CMC-21**: существующий CMC-21 PR #38 остаётся заблокирован до merge CMC-22 и затем продолжается в той же задаче, ветке и PR; CMC-09 PR #34 остаётся приостановлен.
* **Lockfile scope очереди v0.1**: CMC-19 добавил корневой `pnpm-lock.yaml` в локальные контракты CMC-04/05/06/08/09, вставил dependency gate перед CMC-04 и закрепил frozen-install gate в пяти Worker-промптах.
* **Lockfile scope**: CMC-18 добавил зависимость и корневой `pnpm-lock.yaml` в локальный контракт CMC-03, синхронизировал roadmap и закрепил frozen-lockfile gate для Worker.

## 2026-07-17

* **Workspace hygiene**: CMC-17 добавил `node_modules/` в Git ignore до установки pnpm workspace и стал dependency CMC-02.
* **Публичный репозиторий**: CMC-16 закрепил community health, private vulnerability reporting, pinned GitHub Actions, Dependabot, repository gate, squash-only merge и rulesets для `main` и release tags.
* **Публичный продукт**: ADR-0011 заменил персональные app/path rules универсальными protected classes и закрепил synthetic-only public bundle.
* **UX**: канонические действия finding — «Удалить» с quarantine, persistent «Исключить» и session-local «Пропустить сейчас».
* **State**: persistent exclusions хранятся в user Application Support, используют stable identity, versioned schema и atomic writes.
* **Расписание**: ежемесячный read-only аудит работает только через явный opt-in и capability-aware Codex automation bridge; cron и LaunchAgent запрещены.
* **Backlog**: добавлены `CMC-12`/`CMC-13`, а Advanced Cleanup и Browser/Developer Storage вынесены в заблокированные `CMC-14`/`CMC-15`.
* **Полевое исследование**: реальные категории аудита преобразованы в синтетические classifier cases, fixtures и E2E-сценарии без переноса путей, секретов и списка приложений владельца.
* **Решение**: ADR-0010 добавил неизменяемые server-side protected scopes, `supportLevel`, `SafeMetadata` и `DiskObservation`.
* **Граница v0.1**: системные и shared-компоненты показываются только как `unsupported_manual`, без mutation, shell-команд и sudo-рекомендаций.
* **История UX**: ADR-0010 первоначально фиксировал session-local «Оставить»; ADR-0011 заменил его действиями публичного продукта.
* **Решение**: ADR-0009 добавил Quarantine Center, честные метрики размера и отмену read-only аудита.
* **История UI**: ADR-0009 добавил базовые вкладки «Обзор», «Находки» и «Карантин»; ADR-0011 расширил Dashboard вкладками «Исключения» и «Расписание».
* **Контракт**: частичные результаты `cancelled` не разрешают mutation.
* **Legal gate**: владелец прямо разрешил CMC-01 заменить MIT на Apache-2.0; выполнение отложено до отдельного запуска Controller.

## 2026-07-15

* **Product-пакет**: подготовлены PRD, roadmap, TDD-план и десять Worker-промптов.
* **Оркестрация**: репозиторий подготовлен для `codex-cto-orchestrator` beta.6 в issues-mode без активации Controller.
* **Очередь**: созданы GitHub Issues `#1`–`#10`; `#1` заблокирована legal gate, остальные управляются dependencies.
* **Инициализация**: создан OKF bundle документации.
* **Решение**: утверждён безопасный MVP для macOS 26 на Apple Silicon.
* **Решение**: выбран локальный TypeScript MCP-сервер без Swift-компонентов.
* **Решение**: утверждены read-only аудит, поэлементный карантин, восстановление и ручная очистка.
* **Решение**: выбран тёмный Audit Dashboard на shadcn/ui.
* **Решение**: developer cleanup исключён из v0.1.
* **Решение**: выбран Apache-2.0; замена корневого `LICENSE` передана в реализацию.
