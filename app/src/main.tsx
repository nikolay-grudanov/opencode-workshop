import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { queryClient } from "./query-client";
import "./index.css";

// F-016: i18n must be ready BEFORE first render so chat chips and copy don't
// flicker. ensureI18n is idempotent.
import("./i18n").then(({ ensureI18n }) => ensureI18n()).catch((err) => {
  // Non-fatal: the app still works, just with hardcoded strings.
  console.warn("[workshop] i18n init failed", err);
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
