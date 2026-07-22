# Компоненты текущего Dashboard

Источник истины — `apps/widget/src/components/` и `apps/widget/src/components/ui/`. Компоненты уже реализованы на React 19, shadcn `radix-nova`, `radix-ui`, Tailwind CSS v4 и Lucide. Superdesign должен переиспользовать их визуальный язык, а не заменять другой UI-библиотекой.

## Составные продуктовые компоненты

- `AuditProgress`: карточка статуса аудита, текущий этап, процент, число кандидатов, progress bar и поэлементная отмена.
- `StorageSummary`: четыре независимые server-owned метрики в виде доступного bar comparison и отдельная карточка наблюдаемого свободного места.
- `FindingsTable`: таблица объектов с классификацией, размерами, blocking reason и действиями.
- `FindingSheet`: правая панель доказательств и FindingFacts.
- `ActionDialog`: двухфазное подтверждение перемещения ровно одного объекта в карантин.
- `QuarantineCenter`: карточки записей карантина с отдельными restore/purge confirmations.
- `ExclusionsTab`: поиск, фильтр и управление identity-based исключениями.
- `SupportLevel`: текстовый Badge уровня поддержки.

## Реальный API основных UI-примитивов

```tsx
// apps/widget/src/components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)
```

```tsx
// apps/widget/src/components/ui/card.tsx — реальная структура
<div data-slot="card" className="group/card flex flex-col gap-6 overflow-hidden rounded-xl border bg-card py-6 text-card-foreground shadow-sm" />
<div data-slot="card-header" className="grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]" />
<div data-slot="card-content" className="px-6" />
<div data-slot="card-footer" className="flex items-center px-6" />
```

```tsx
// apps/widget/src/components/ui/tabs.tsx — используемый line variant
<TabsList variant="line" className="max-w-full overflow-x-auto" />
<TabsTrigger value="overview">Обзор</TabsTrigger>
<TabsTrigger value="findings">Находки</TabsTrigger>
<TabsTrigger value="quarantine">Карантин</TabsTrigger>
<TabsTrigger value="exclusions">Исключения</TabsTrigger>
<TabsTrigger value="schedule">Расписание</TabsTrigger>
```

Доступные primitives: `Alert`, `AlertDialog`, `Badge`, `Button`, `Card`, `Field`, `Input`, `Label`, `NativeSelect`, `Progress`, `Separator`, `Sheet`, `Skeleton`, `Sonner`, `Table`, `Tabs`, `Tooltip`. Для визуальных draft не добавлять новый runtime dependency.
