import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const DASHBOARD_RESOURCE_URI =
  "ui://codex-mac-cleaner/dashboard-v2.html" as const;
export const DASHBOARD_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app" as const;

async function loadPackagedDashboard(): Promise<string> {
  const pluginRoot = process.env.CODEX_MAC_CLEANER_PLUGIN_ROOT;
  if (pluginRoot !== undefined && pluginRoot.length > 0) {
    return readFile(
      resolve(pluginRoot, ".codex-plugin/assets/dashboard-v2.html"),
      "utf8",
    );
  }
  return readFile(
    new URL("../../../../.codex-plugin/assets/dashboard-v2.html", import.meta.url),
    "utf8",
  );
}

export function registerDashboardResource(
  server: McpServer,
  dashboardHtml?: string,
): void {
  server.registerResource(
    "codex-mac-cleaner-dashboard-v2",
    DASHBOARD_RESOURCE_URI,
    {
      title: "Codex Mac Cleaner — проверка Mac",
      description: "Локальное окно с результатами проверки и карантином.",
      mimeType: DASHBOARD_RESOURCE_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: DASHBOARD_RESOURCE_URI,
          mimeType: DASHBOARD_RESOURCE_MIME_TYPE,
          text: dashboardHtml ?? (await loadPackagedDashboard()),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                redirectDomains: ["https://github.com", "https://dzzen.com"],
              },
            },
            "openai/widgetDescription":
              "Окно показывает безопасные результаты проверки. Пользователь подтверждает каждое действие отдельно.",
          },
        },
      ],
    }),
  );
}
