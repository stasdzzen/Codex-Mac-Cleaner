import { startMcpServer } from "./server.js";

if (!process.argv.includes("--stdio")) {
  throw new Error("SUPPORTED_TRANSPORT_STDIO_ONLY");
}

await startMcpServer();
