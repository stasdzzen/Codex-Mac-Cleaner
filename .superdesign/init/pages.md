# Страницы и дерево зависимостей

## Audit Dashboard

```text
dashboard-v2.html
└── src/main.tsx
    ├── src/styles.css
    └── src/app.tsx
        ├── AuditDashboard
        │   ├── Hero header + ProjectFooter
        │   ├── Alert / terminal states
        │   ├── Tabs
        │   │   ├── Overview
        │   │   │   ├── AuditProgress
        │   │   │   ├── StorageSummary
        │   │   │   └── summary Card
        │   │   ├── FindingsTable
        │   │   │   ├── SupportLevel
        │   │   │   └── ActionDialog
        │   │   ├── QuarantineCenter
        │   │   ├── ExclusionsTab
        │   │   └── ScheduleFallbackCard
        │   └── FindingSheet
        └── Toaster
```

## Состояния, которые дизайн обязан учитывать

- queued/running/cancelling с live progress;
- completed и completed_with_warnings с actionable revision;
- cancelled/failed без mutation actions;
- отсутствие находок;
- blocked finding с текстовым blocking reason;
- пустой и заполненный карантин;
- empty/loading/error/filter-empty exclusions;
- narrow Codex side panel и fullscreen.

Baseline preview использует только `standaloneFixture`: completed_with_warnings, одна candidate finding, одна запись карантина и один coverage warning. Он не содержит реальных данных Mac.
