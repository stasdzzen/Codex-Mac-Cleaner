# Тема текущего Dashboard

Тема определена в `apps/widget/src/styles.css`; Tailwind CSS v4 mapping использует semantic tokens. Product default — dark. Внешние шрифты не загружаются.

## Типографика и геометрия

- Sans: `Open Sans, sans-serif` (local-first, без network fetch).
- Mono: `Menlo, monospace`.
- Serif: `Georgia, serif`.
- Radius: `1.3rem`; производные `sm`…`4xl` задаются в `@theme inline`.
- Тени намеренно плоские: offset `0 2px`, blur/spread `0`, opacity `0`.
- Иконки: Lucide; brand mark — локальный PNG.

## Semantic palette

| Token | Light | Dark | Роль |
|---|---|---|---|
| background | `#ffffff` | `#000000` | фон страницы |
| foreground | `#0f1419` | `#e7e9ea` | основной текст |
| card | `#f7f8f8` | `#17181c` | surface карточек |
| card-foreground | `#0f1419` | `#d9d9d9` | текст карточек |
| primary | `#1e9df1` | `#1c9cf0` | основное действие / прогресс |
| accent | `#E3ECF6` | `#061622` | hover / selected surface |
| muted | `#E5E5E6` | `#181818` | нейтральные треки |
| muted-foreground | `#0f1419` | `#72767a` | вторичный текст |
| border | `#e1eaef` | `#242628` | границы |
| destructive | `#f4212e` | `#f4212e` | необратимые действия / error |
| chart-1 | `#1e9df1` | `#1e9df1` | logical bytes |
| chart-2 | `#00b87a` | `#00b87a` | physical bytes |
| chart-3 | `#f7b928` | `#f7b928` | quarantine bytes |
| chart-4 | `#17bf63` | `#17bf63` | purged bytes |

## Фон и motion

На body — один слабый radial gradient primary в левом верхнем углу. Hero использует едва заметную primary-подсветку. Motion разрешён только для появления страницы, active audit pulse/scan и раскрытия bar comparison. Для terminal audit анимация прогресса прекращается. `prefers-reduced-motion: reduce` сводит animation/transition к 0.01 ms.

Нельзя вводить raw цвета внутрь компонентов, внешние font/CDN resources, backdrop-heavy glassmorphism или декоративную анимацию, не связанную с состоянием аудита.
