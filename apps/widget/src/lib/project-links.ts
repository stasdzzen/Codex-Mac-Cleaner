export const PROJECT_LINKS = {
  repository: "https://github.com/stasdzzen/Codex-Mac-Cleaner",
  ideas:
    "https://github.com/stasdzzen/Codex-Mac-Cleaner/discussions/new?category=ideas",
  developer: "https://dzzen.com",
  support: "https://dzzen.com/support",
} as const;

export type WidgetExternalUrl =
  (typeof PROJECT_LINKS)[keyof typeof PROJECT_LINKS];

const ALLOWED_EXTERNAL_URLS = new Set<WidgetExternalUrl>(
  Object.values(PROJECT_LINKS),
);

export function isAllowedExternalUrl(value: string): value is WidgetExternalUrl {
  return ALLOWED_EXTERNAL_URLS.has(value as WidgetExternalUrl);
}
