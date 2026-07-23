# История архитектурного канона

## 2026-07-23

* **Полный аудит**: ADR-0019 удалил общий hard/soft/progress-aware deadline; отдельный timeout источника создаёт coverage gap, но не отменяет обработку остальных кандидатов.
* **Bounded Dashboard**: ADR-0020 и CMC-47 ввели Dashboard v3, независимые model/widget cursors, лимиты 100 findings и 512 КиБ на страницу и app-only `dashboard_page`.
* **Native tool flow**: CMC-46 закрепил один штатный host discovery, exact terminal revision и fail-closed `AUDIT_STALE` без Terminal, direct stdio, local HTML и автоматического повторного аудита.
* **Выпуск**: CMC-48 опубликовал `v0.1.0-beta.11` из merge SHA `b5a61bf362330b0f9620547ef54fde3603b0b76e`.
* **Защита от регрессии**: CMC-49 добавил privacy-safe troubleshooting, capability matrix и read-only probe точной packaged MCP App поверхности.
* **Выпуск**: CMC-50 опубликовал [`v0.1.0-beta.12`](https://github.com/stasdzzen/Codex-Mac-Cleaner/releases/tag/v0.1.0-beta.12) из merge SHA `afe603dd9e26bca221ea6496a8f2e51ea40f7a4b`; шесть release assets сверены побайтно, probe вошёл в release gates, а real-Mac smoke остался отдельным действием владельца.

## 2026-07-22

* **Dashboard presentation**: ADR-0016 удалил продуктовый PiP и сохранил только явный fullscreen-запрос пользователя без обещания размещения в правой панели.
* **Footer**: ADR-0017 разрешил только host-mediated переходы после клика на закрытый GitHub/dzzen allowlist без внешних fetch и telemetry.
* **Производительность и диагностика**: ADR-0018 закрепил bounded concurrency восемь, десятичные МБ/ГБ и read-only diagnostics отсутствующих target executable без расширения mutation scope.
* **Выпуск**: CMC-45 опубликовал `v0.1.0-beta.10`; последующая owner-проверка выявила task-scoped tool и oversized-response регрессии, исправленные в beta.11.

## 2026-07-21

* **Live Dashboard**: ADR-0015 ввёл Dashboard v2 сразу после `audit_start`, nullable pre-result revision и server-owned progress без ранних findings/actions.
* **Shared inventories**: installed app, process, open-file, startup и package inventories снимаются один раз для Snapshot A и один раз для Snapshot B; candidate-specific evidence остаётся отдельным.

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
