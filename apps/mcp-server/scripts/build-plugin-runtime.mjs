import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const scriptDirectory = dirname(new URL(import.meta.url).pathname);
const repositoryRoot = resolve(scriptDirectory, "../../..");
const widgetRoot = join(repositoryRoot, "apps/widget");
const require = createRequire(import.meta.url);
const reactEntry = require.resolve("react", { paths: [widgetRoot] });
const reactJsxRuntime = require.resolve("react/jsx-runtime", {
  paths: [widgetRoot],
});

async function importFromWidget(packageName) {
  const entrypoint = require.resolve(packageName, { paths: [widgetRoot] });
  return import(pathToFileURL(entrypoint).href);
}

function stripTrailingWhitespace(value) {
  return value.replace(/[\t ]+$/gmu, "");
}

const [{ build: buildWidget }, { default: react }, { default: tailwindcss }] =
  await Promise.all([
    importFromWidget("vite"),
    importFromWidget("@vitejs/plugin-react"),
    importFromWidget("@tailwindcss/vite"),
  ]);

const temporaryRoot = await mkdtemp(join(tmpdir(), "cmc-dashboard-build-"));
const widgetOutput = join(temporaryRoot, "widget");
const dashboardTarget = join(
  repositoryRoot,
  ".codex-plugin/assets/dashboard-v1.html",
);
const runtimeTarget = join(repositoryRoot, ".codex-plugin/runtime/server.js");

try {
  await buildWidget({
    configFile: false,
    root: widgetRoot,
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: /^react$/u, replacement: reactEntry },
        { find: /^react\/jsx-runtime$/u, replacement: reactJsxRuntime },
        {
          find: "@/lib/bridge",
          replacement: join(
            repositoryRoot,
            "apps/mcp-server/src/resources/widget-bridge.ts",
          ),
        },
        {
          find: "@/app",
          replacement: join(
            repositoryRoot,
            "apps/mcp-server/src/resources/widget-app.tsx",
          ),
        },
        { find: "@", replacement: join(widgetRoot, "src") },
      ],
    },
    build: {
      outDir: widgetOutput,
      emptyOutDir: true,
      rollupOptions: { input: join(widgetRoot, "dashboard-v1.html") },
    },
  });

  const builtHtmlPath = join(widgetOutput, "dashboard-v1.html");
  let html = await readFile(builtHtmlPath, "utf8");
  const scriptMatch = html.match(
    /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"\s*><\/script>/u,
  );
  const styleMatch = html.match(
    /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)"\s*>/u,
  );
  if (scriptMatch?.[1] === undefined || styleMatch?.[1] === undefined) {
    throw new Error("DASHBOARD_ASSET_LINKS_NOT_FOUND");
  }
  const script = await readFile(resolve(widgetOutput, scriptMatch[1]), "utf8");
  const style = await readFile(resolve(widgetOutput, styleMatch[1]), "utf8");
  html = html
    .replace(scriptMatch[0], `<script type="module">${script}</script>`)
    .replace(styleMatch[0], `<style>${style}</style>`);
  const scriptStart = html.indexOf('<script type="module">');
  const scriptEnd = html.lastIndexOf("</script>");
  const withoutScript =
    scriptStart >= 0 && scriptEnd > scriptStart
      ? `${html.slice(0, scriptStart)}${html.slice(scriptEnd + "</script>".length)}`
      : html;
  const styleStart = withoutScript.indexOf("<style>");
  const styleEnd = withoutScript.lastIndexOf("</style>");
  const documentShell =
    styleStart >= 0 && styleEnd > styleStart
      ? `${withoutScript.slice(0, styleStart)}${withoutScript.slice(styleEnd + "</style>".length)}`
      : withoutScript;
  if (/<(?:script|link)[^>]+(?:src|href)=["'][^"']+/iu.test(documentShell)) {
    throw new Error("DASHBOARD_EXTERNAL_ASSET_REFERENCE");
  }
  await mkdir(dirname(dashboardTarget), { recursive: true });
  await writeFile(dashboardTarget, stripTrailingWhitespace(html), "utf8");

  await mkdir(dirname(runtimeTarget), { recursive: true });
  await buildWidget({
    configFile: false,
    root: repositoryRoot,
    define: { "process.env.NODE_ENV": '"production"' },
    build: {
      ssr: join(repositoryRoot, "apps/mcp-server/src/cli.ts"),
      outDir: dirname(runtimeTarget),
      emptyOutDir: true,
      minify: true,
      rollupOptions: {
        output: { entryFileNames: "server.js", format: "es" },
      },
    },
    ssr: { noExternal: true },
  });
  const runtime = await readFile(runtimeTarget, "utf8");
  await writeFile(runtimeTarget, stripTrailingWhitespace(runtime), "utf8");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
