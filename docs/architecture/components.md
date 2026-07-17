---
type: Architecture
title: Компоненты Codex Mac Cleaner
description: Обязанности и зависимости компонентов Skill, MCP App и локального MCP-сервера.
tags: [architecture, components, mcp, ui]
status: approved
owner: Architect
date: 2026-07-15
---

# Архитектурный стиль

Плагин использует interactive-decoupled архитектуру: data tools, render tool и mutation-tools разделены. Dashboard остаётся смонтированным и обновляется через MCP Apps bridge без повторного создания UI после каждого действия.

# Skill

Skill отвечает за диалог:

* объясняет границы и разрешения;
* запускает профиль `application_remnants`;
* сообщает о непроверенных областях;
* открывает Dashboard;
* не генерирует shell-команды и не просит подтверждать шаги сообщением «готово»;
* не интерпретирует файловые пути как разрешение;
* не вызывает app-visible mutation-tools.

# MCP App

React/Vite widget использует shadcn/ui и тёмную тему. Основная компоновка — Audit Dashboard:

* `Card` для сводки;
* `Progress` для аудита;
* `Table` для находок;
* `Badge` для меток, уверенности и риска;
* `Sheet` для доказательств;
* `Alert` для coverage gaps и предупреждений;
* `AlertDialog` для карантина, восстановления и очистки;
* `Tabs` для «Обзора», «Находок» и «Карантина»;
* `Button` и `Tooltip` для действий и кратких пояснений;
* `Skeleton` для загрузки;
* `sonner` для короткой обратной связи.

Тема использует semantic tokens shadcn/ui. Raw colors, ручные `dark:` overrides и внешние CDN запрещены. Версия UI-ресурса начинается с `ui://codex-mac-cleaner/dashboard-v1.html`.

Widget получает начальный snapshot из ответа `dashboard_open`, а последующие данные и app-only actions — через MCP Apps bridge. `stateVersion` монотонен: ответ со старой версией отбрасывается. Widget state хранит только представление — фильтр, выделенную строку, открытую панель и `reviewedFindingIds` текущей ревизии; пути, tokens и решения policy в него не копируются. «Оставить» добавляет ID в этот session-local список, не вызывает tool и не влияет на новый аудит.

Dashboard показывает server-owned значения «Логический размер находок», «Физический размер находок», «В карантине», «Удалено навсегда» и «Свободно на диске». UI не суммирует данные сам, показывает время наблюдения диска и не трактует его изменение как результат purge.

# Локальный MCP-сервер

Сервер написан на TypeScript/Node.js и включает следующие модули.

## Transport и schemas

Регистрирует tools, UI resource и точные input/output schemas. Все внешние данные проходят runtime-валидацию.

## Audit Coordinator

Управляет жизненным циклом аудита, capability report, двумя снимками состояния, кооперативной отменой и immutable revision. Частичный отчёт `cancelled` не становится actionable revision.

## Source Adapters

Каждый адаптер читает один класс источников и возвращает observations либо structured warnings:

* установленные приложения;
* пользовательские Library artifacts;
* процессы и открытые файлы;
* пользовательский автозапуск как candidate evidence и targeted inspection системного автозапуска;
* package receipts;
* APFS и файловые метаданные.

Candidate adapters обходят только девять allowlisted roots пользовательской `Library`. Targeted inspection системных и shared-источников создаёт только `unsupported_manual` и никогда не расширяет mutation scope.

## Safe Metadata Filter

Разбирает JSON/YAML/plist как недоверенные данные и до persistence оставляет только `SafeMetadata`. Сырые ключи, значения, секреты, subscription URLs, stderr и полный путь отбрасываются.

## Protected Scope Registry

Хранит встроенные неизменяемые правила для canonical prefixes, owner identities и локальных Git-проектов. Проверяется до создания кандидата и повторно в Action Controller; UI и MCP inputs не могут менять registry.

## Normalizer

Канонизирует идентификаторы и пути без follow-symlink, связывает bundle IDs и удаляет дубликаты наблюдений.

## Classifier

Применяет версионированные именованные правила к `EvidenceSet`. Не использует LLM, вероятностную модель или скрытый числовой score.

## Policy Engine

Вычисляет `allowedActions` независимо от classifier. Учитывает `supportLevel`, категорию данных, protected scope, owner identity, installed state, dependencies, активность, открытые файлы, sensitivity flags, missing evidence и snapshot fingerprint.

## Action Controller

Создаёт preview tokens, блокирует повторное использование, выполняет revalidation и вызывает quarantine transaction.

## Local Store

Хранит immutable reports, append-only journal и operation manifests без базы данных.

# Исключённые компоненты

В v0.1 нет Swift-helper, SQLite, облачного backend, аккаунтов, фонового демона, telemetry SDK и native system extension.

# Источники

1. [OpenAI Apps SDK: Define tools](https://developers.openai.com/apps-sdk/plan/tools/)
2. [OpenAI Apps SDK: Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)
3. [shadcn/ui](https://ui.shadcn.com/)
