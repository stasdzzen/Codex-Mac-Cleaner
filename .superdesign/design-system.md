# Codex Mac Cleaner — design system

## Контекст продукта

Codex Mac Cleaner — локальный MCP App Dashboard внутри Codex. Он проводит доказательный read-only аудит остатков удалённых приложений и даёт владельцу принять решение над каждым объектом отдельно. Интерфейс не является обычным «cleaner»: он должен объяснять, почему объект найден, какой риск видит policy и почему действие доступно или заблокировано.

Главная поверхность v0.1 — правая панель Codex; fullscreen вторичен. Язык интерфейса — русский. Тёмная тема включена по умолчанию.

## Принципы

1. **Доказательства раньше действия.** Название, classification, owner/evidence summary, risk и blocking reason должны быть понятнее и заметнее destructive CTA.
2. **Один объект — одно решение.** Никакого select all, bulk action или автоматического удаления.
3. **Карантин раньше purge.** Основной destructive-looking action на finding фактически перемещает один объект в карантин после server prepare; окончательное удаление отделено.
4. **Server-owned truth.** UI отображает snapshot и version; он не вычисляет policy, не принимает path/glob/command и не обещает освобождение APFS.
5. **Спокойная уверенность.** Внешний вид профессиональный и дружелюбный, без alarmist-красного за пределами error/purge.
6. **Состояние понятно без цвета.** Risk, status и blocking reason всегда продублированы текстом и иконкой/структурой.

## Visual language

- Основа: установленный shadcn `radix-nova`; не менять библиотеку и не добавлять runtime dependencies.
- Поверхности: чёрный background, графитовые cards, тонкие нейтральные borders.
- Primary blue (`#1c9cf0`) означает навигацию, прогресс и положительное primary action.
- Green/yellow используются только для независимых chart series или ясного статуса.
- Red (`#f4212e`) — error и необратимое purge; не использовать как общий декоративный акцент.
- Radius `1.3rem` создаёт мягкие, но не игрушечные поверхности.
- Иконка плагина должна быть видна в header без декоративного дублирования.
- Шрифт local-first: `Open Sans, sans-serif`; числа — tabular, bytes — десятичные МБ/ГБ.

## Layout

- Целевой draft viewport: 520×900 px, потому что Dashboard открывается справа в Codex.
- Первый экран должен сразу отвечать: идёт ли аудит, сколько найдено, какой объём найден и что безопасно делать дальше.
- Navigation tabs остаются доступными; в узкой панели допускается scroll.
- Находки должны переходить из широкой таблицы в более читаемую компактную структуру, если таблица вынуждает горизонтальный скролл.
- Footer остаётся компактным и не конкурирует с действиями аудита.

## Components and states

- Hero: product identity, короткое safety-объяснение, display-mode action, diagnostic stateVersion вторичным текстом.
- Audit progress: phase, progress, processed candidates, cancel только при active state.
- Storage comparison: четыре независимые bar series и отдельное disk observation; значения не суммируются.
- Finding: identity, classification/confidence/risk, logical/physical size, support level, reason, inspect/exclude/quarantine actions.
- Evidence sheet: сканируемая группировка facts, estimate, blockers и evidence.
- Confirmations: отдельные prepare и confirm, предмет действия назван явно, cancel всегда доступен.
- Empty/error/unsupported states — полноценные, не placeholder.

## Motion and accessibility

- Motion показывает только активный процесс и мягко вводит новый snapshot.
- Не анимировать terminal states, destructive confirmations или background постоянно.
- Полностью уважать `prefers-reduced-motion`.
- Видимый focus ring, минимум WCAG AA contrast, targets не меньше текущих shadcn sizes.
- Icon-only допустим только для GitHub с `aria-label` и tooltip; критические actions всегда имеют текст.

## Запреты

- Полные пути, токены, пароли, персональные данные и реальные Mac fixtures.
- Shell commands, destination/path inputs, sudo/TCC bypass.
- Bulk delete, автоматическая очистка, «освободим X ГБ» как обещание.
- Внешние fonts, CDN, telemetry, analytics.
- Новые backend/MCP contracts в рамках design iteration.
