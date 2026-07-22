# Миграция Dashboard на Base UI

## Режим

- Полная миграция `apps/widget` с `radix-nova` на `base-mira`.
- Эталон создан официальной командой shadcn с пресетом владельца `b1a0RuLKa` во временном каталоге.
- В репозитории сохранены продуктовые настройки: русские подписи, пообъектные подтверждения и локальный тёмный режим.

## Компоненты

- На Base UI переведены `button`, `alert-dialog`, `badge`, `label`, `progress`, `separator`, `sheet`, `tabs` и `tooltip`.
- К пресету Base Mira приведены `alert`, `card`, `field`, `input`, `native-select` и `table`.
- `skeleton` и локальная обёртка `sonner` уже были совместимы и не потребовали смены примитива.
- Все переходы композиции `asChild` заменены на `render` Base UI.

## Зависимости

- Добавлен `@base-ui/react` версии `1.6.0`.
- Пакет `radix-ui` и его транзитивные зависимости удалены после завершения миграции.

## Проверки

- `pnpm dlx shadcn@latest info --json`: `style=base-mira`, `base=base`.
- `rg 'radix-ui|@radix-ui' apps/widget/package.json apps/widget/src pnpm-lock.yaml`: совпадений нет.
- `rg '\\basChild\\b' apps/widget/src`: совпадений нет.
- `pnpm --filter @codex-mac-cleaner/widget typecheck`: успешно.
- `pnpm --filter @codex-mac-cleaner/widget test`: успешно, 36 тестов.
- `pnpm --filter @codex-mac-cleaner/widget build`: успешно.

## Изменения поведения

- Вкладки используют ручную активацию Base UI и сохраняют навигацию стрелками, Home и End.
- Диалог подтверждения закрывается явно только после успешного асинхронного действия; при ошибке остаётся открыт.
- Прогресс вычисляет заполнение через примитив Base UI без ручного CSS-transform.
