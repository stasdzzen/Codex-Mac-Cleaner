# Superdesign: Codex Mac Cleaner Dashboard

Проект создан 22 июля 2026 года для Issue #72 / CMC-38. Canvas использует только публичный source widget, локальные design-документы и synthetic fixture. Реальные данные Mac, локальные пути, секреты и runtime state не передавались.

- Project ID: `9d0a2972-9c20-41d7-bfa1-eaecc3ca784f`
- Canvas: <https://superdesign.dev/teams/f850d0d2-f261-4fcf-98af-dc4ce69b32b3/projects/9d0a2972-9c20-41d7-bfa1-eaecc3ca784f>
- Целевой viewport: `520×900` px, правая панель Codex.

## Drafts

1. Baseline — текущий Audit Dashboard
   - Draft ID: `51be4138-596c-4a3f-9c14-c4b140f40aae`
   - Node: <https://superdesign.dev/teams/f850d0d2-f261-4fcf-98af-dc4ce69b32b3/projects/9d0a2972-9c20-41d7-bfa1-eaecc3ca784f?node=draft-variant-51be4138-596c-4a3f-9c14-c4b140f40aae>
2. «Спокойный проводник» / Focused Dashboard
   - Draft ID: `93229b1d-5d4f-4d41-bec5-5bf4e3976dec`
   - Node: <https://superdesign.dev/teams/f850d0d2-f261-4fcf-98af-dc4ce69b32b3/projects/9d0a2972-9c20-41d7-bfa1-eaecc3ca784f?node=draft-variant-93229b1d-5d4f-4d41-bec5-5bf4e3976dec>
3. «Контрольная панель» / Compact Audit Dashboard
   - Draft ID: `b1730a5e-225d-4033-8b26-35e9f752e8ec`
   - Node: <https://superdesign.dev/teams/f850d0d2-f261-4fcf-98af-dc4ce69b32b3/projects/9d0a2972-9c20-41d7-bfa1-eaecc3ca784f?node=draft-variant-b1730a5e-225d-4033-8b26-35e9f752e8ec>

## Review

Все drafts проверены в Chromium на viewport 520×900. Horizontal overflow и обрезанные интерактивные элементы не обнаружены. В компактной ветке одной replace-итерацией исправлена группировка identity block, восстановлены видимая кнопка «Развернуть» и точный label `stateVersion: 1`.

Рекомендованное направление — «Спокойный проводник»: оно яснее связывает завершённый аудит со следующим безопасным поэлементным решением. Это только design recommendation. Ни один вариант не переносится в production UI до отдельного выбора владельца; при переносе сохраняются утверждённые product copy, MCP contracts и safety-инварианты.
