import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CertificationFinder } from "@iiba/ui";
import "@iiba/ui/styles.css";

// Set VITE_RULES_URL in .env to load hosted rules; otherwise the bundled copy is used.
const rulesUrl = import.meta.env.VITE_RULES_URL as string | undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CertificationFinder rulesUrl={rulesUrl} />
  </StrictMode>,
);
