import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { App } from "./app";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
