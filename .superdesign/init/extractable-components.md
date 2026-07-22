# Кандидаты на canvas-компоненты

Отдельное извлечение DraftComponents не требуется.

Причина: приложение содержит одну страницу, а её header/footer и safety-actions не переиспользуются между разными routes. Общие primitives уже представлены реальным shadcn source в `apps/widget/src/components/ui/`; продуктовые блоки передаются Superdesign как source context целиком. Создание параллельной canvas-библиотеки внесло бы второй источник истины без практического reuse.

Если позже появятся отдельные Dashboard routes, первыми кандидатами станут:

- `DashboardHeader` — logo, product identity, display mode и stateVersion;
- `ProjectFooter` — GitHub, ideas, developer, support;
- `SafetyActionDialog` — prepare/confirm pattern для одного объекта;
- `MetricComparisonCard` — независимые server-owned byte metrics.

До этого design drafts должны ссылаться на текущие source components и не изобретать новые runtime contracts.
