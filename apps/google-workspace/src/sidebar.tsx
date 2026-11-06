import { mount } from "@iiba/ui";
import css from "@iiba/ui/styles.css?inline";

// Runs inside the Google Workspace sidebar (Sheets / Docs / Slides). Same component and
// shared core as the website, browser extension and WordPress plugin.
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

const root = document.getElementById("root");
if (root) mount(root, { compact: true, hideIntro: true });
