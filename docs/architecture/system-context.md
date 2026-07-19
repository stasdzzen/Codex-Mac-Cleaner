---
type: Architecture
title: Системный контекст Codex Mac Cleaner
description: Акторы, доверительные границы и внешние зависимости безопасного локального плагина.
tags: [architecture, context, boundaries]
status: approved
owner: Architect
date: 2026-07-19
---

# Назначение системы

Codex Mac Cleaner работает на Mac пользователя и не требует облачного backend. Codex помогает начать аудит и объяснить результаты, но локальный сервер единолично решает, какие действия допустимы.

# Акторы и системы

| Актор или система | Роль | Уровень доверия |
|---|---|---|
| Пользователь | Запускает аудит и подтверждает по одному действию | Источник намерения, но не источник пути |
| Codex и Skill | Ведут диалог и вызывают model-visible tools; в v0.1 не управляют automation | Недоверенный инициатор структурированных запросов |
| MCP App | Показывает Dashboard и вызывает app-visible tools | Недоверенный клиент серверной политики |
| Локальный MCP-сервер | Сканирует, классифицирует и выполняет разрешённые действия | Единственный субъект с доступом к файловой системе |
| macOS 26 | Даёт файловые метаданные, процессы и сведения об автозапуске | Внешний системный источник с меняющимися форматами |
| Локальное хранилище | Хранит отчёты, exclusions, инертный schedule skeleton, манифесты, журнал и payload | Доверенная область только после проверки прав, schema и пути |
| Codex automation host | Будущий post-v0.1 boundary для opt-in read-only расписания | Не входит в runtime/release surface v0.1 и требует отдельного owner decision |
| GitHub Releases и marketplace | Доставляют плагин пользователю | Supply-chain граница |

# Доверительные границы

1. **Codex → MCP-tools.** Текстовый запрос превращается только в данные, прошедшие input schema. Модель не передаёт путь в mutation-tools.
2. **MCP App → локальный сервер.** Widget получает структурированные данные, но сервер не доверяет скрытому состоянию и повторяет все проверки.
3. **Сервер → macOS.** Пути, plist, имена процессов и вывод команд считаются недоверенными данными.
4. **Отчёт → действие.** Только неизменяемые audit/correlation revisions и действующий server-side preview token связывают находку с операцией; widget получает opaque action handle.
5. **Adapters → correlation.** Raw local identity claims существуют только внутри server process. Модель и widget получают safe facts, а пустой source output без completeness certificate остаётся `unknown`.
5. **Исходный путь → карантин.** Перемещение разрешено только на том же APFS-томе и внутри управляемого quarantine root.
6. **Релиз → установленный плагин.** Checksum, SBOM и provenance подтверждают происхождение пакета.
7. **Конфигурация → evidence.** JSON/YAML/plist редактируются до persistence и MCP output; сырые значения не пересекают локальную parser boundary.
8. **MCP App → schedule skeleton.** В v0.1 Widget показывает disabled/manual-run fallback; schemas/intents не приводят к host action. Post-v0.1 bridge потребует отдельного owner decision.

# Архитектурные инварианты

* сеть не нужна для основного сценария;
* UI не читает и не меняет файлы напрямую;
* classifier не выдаёт разрешение на действие;
* mutation-контур принимает только серверные идентификаторы и токены;
* любой stale, conflict или inconsistent state блокирует действие;
* активный процесс, открытый файл или запрещённый путь блокирует карантин;
* встроенные protected scopes проверяются до создания кандидата и перед каждой mutation;
* пользовательские exclusions не ослабляют protected scopes и не совпадают только по path;
* системные и shared-находки не выходят за `unsupported_manual` и не получают shell-команды;
* v0.1 не создаёт scheduled run или host automation; ручной fallback запускает существующий read-only audit;
* ни отсутствие capability, ни будущая интеграция не разрешают cron, LaunchAgent или скрытый scheduler;
* публичный bundle не содержит персональных app/path rules разработчика;
* основной продуктовый сценарий не требует терминала;
* root `LICENSE` должен перейти на Apache-2.0 до первой реализации.

# Связанные концепты

* [Компоненты](components.md)
* [Threat model](../safety/threat-model.md)
* [MCP-tools](../contracts/mcp-tools.md)

# Источники

1. [Codex: Build plugins](https://developers.openai.com/codex/plugins/)
2. [OpenAI Apps SDK: Build MCP server](https://developers.openai.com/apps-sdk/build/mcp-server/)
3. [Apple Service Management](https://developer.apple.com/documentation/servicemanagement/)
