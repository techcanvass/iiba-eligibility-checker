import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CertificationFinder } from "@iiba/ui";
import "@iiba/ui/styles.css";

// To use hosted rules, set the URL here AND serve the JSON with Access-Control-Allow-Origin: *.
const RULES_URL: string | undefined = undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CertificationFinder rulesUrl={RULES_URL} compact />
  </StrictMode>,
);
