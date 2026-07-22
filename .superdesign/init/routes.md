# Routes и entrypoints

У widget один production route и один entrypoint.

| Route / asset | Entry | Назначение |
|---|---|---|
| `dashboard-v2.html` | `src/main.tsx` → `src/app.tsx` → `AuditDashboard` | Autonomous MCP App Dashboard для Codex |

`dashboard-v2.html` задаёт `lang="ru"`, класс `dark`, `color-scheme: dark` и root для React. Vite собирает относительный автономный asset (`base: "./"`) в `apps/widget/dist/`. Клиентская маршрутизация отсутствует: разделы Dashboard — controlled tabs, а не URL routes.

```html
<!doctype html>
<html lang="ru" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>Codex Mac Cleaner — Audit Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

В production snapshot приходит через MCP App bridge; для browser/design preview используется только публичный synthetic fixture `src/lib/standalone-fixture.ts`.
