# Layout текущего Dashboard

Dashboard — самостоятельная адаптивная страница внутри правой панели Codex с возможностью fullscreen. Общий контейнер:

```tsx
<TooltipProvider>
  <main className="dashboard-enter mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
    <header>{/* hero card: logo, title, fullscreen, stateVersion */}</header>
    {/* coverage / failed / cancelled alert */}
    <Tabs>{/* overview, findings, quarantine, exclusions, schedule */}</Tabs>
    <ProjectFooter />
    <FindingSheet />
  </main>
</TooltipProvider>
```

## Иерархия Overview

1. Hero card с логотипом, названием продукта, кратким safety-объяснением и кнопкой «Развернуть».
2. Coverage warning или terminal-state alert.
3. Горизонтальные line-tabs с прокруткой в узкой панели.
4. `AuditProgress`.
5. `StorageSummary`: на широком экране comparison и disk observation в сетке `1.65fr / 0.75fr`, в панели — одна колонка.
6. Краткая сводка находок.
7. Footer со ссылками проекта.

## Остальные разделы

- «Находки»: responsive table, где полный путь намеренно отсутствует; детали открываются в `Sheet`.
- «Карантин»: grid карточек, каждая запись имеет отдельные restore и purge dialogs.
- «Исключения»: фильтры в card, затем grid entries.
- «Расписание»: fallback card; в v0.1 только ручной запуск read-only аудита.

## Точки адаптации

- Основной целевой viewport: правая панель Codex около 520×900 px.
- Базовые отступы: `p-4`, `gap-5`; с `sm` — `p-6`.
- Большие сетки раскрываются только на `lg`.
- Tabs допускают горизонтальную прокрутку.
- Все критические кнопки сохраняют видимый текст, не становятся icon-only.
- Sheet и dialogs не должны перекрывать возможность отменить действие.

Footer является частью страницы и при коротком содержимом прижат вниз через `mt-auto`; отдельного общего site shell или sidebar в v0.1 нет.
