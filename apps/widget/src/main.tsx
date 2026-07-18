import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app";
import "@/styles.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Не найден root для Audit Dashboard.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
