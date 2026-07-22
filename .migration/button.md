# Button

- Источник: официальный компонент shadcn из пресета `b1a0RuLKa` (`base-mira`).
- Примитив: `@base-ui/react/button` вместо Slot/Radix-совместимого `asChild`.
- Сохранено: варианты `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` и размеры из пресета.
- Поведение: без изменений для существующих обычных кнопок; композиция далее использует `render` Base UI.
- Проверка: `pnpm --filter @codex-mac-cleaner/widget typecheck`.
