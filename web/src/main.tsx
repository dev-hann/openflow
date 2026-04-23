import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initErrorReporter } from "./services/error-reporter";

initErrorReporter(() => {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const expiresAt = parsed.accessExpiresAt ?? 0;
    if (Date.now() > expiresAt) return undefined;
    return parsed.accessToken as string;
  } catch {
    return undefined;
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
