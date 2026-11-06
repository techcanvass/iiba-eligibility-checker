import { mount } from "@iiba/ui";
// Styles are bundled INTO the JS and injected at runtime, not shipped as a separate .css file.
// Optimisation plugins with "remove unused CSS" (WP-Optimize, LiteSpeed, WP Rocket…) scan the
// page before the finder is drawn, decide its styles are unused and strip them. A <style> tag
// added by this script after the scan can't be stripped.
import css from "@iiba/ui/styles.css?inline";

const STYLE_ID = "bacf-styles";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Mounts a finder into every `.bacf-root` element the shortcode prints.
 * Settings come from data-* attributes, so several instances can coexist on one page.
 */
function init() {
  const roots = document.querySelectorAll<HTMLElement>(".bacf-root:not([data-mounted])");
  if (roots.length === 0) return;
  injectStyles();
  roots.forEach((el) => {
    el.dataset.mounted = "1";
    mount(el, {
      rulesUrl: el.dataset.rulesUrl || undefined,
      compact: el.dataset.compact === "1",
      hideIntro: el.dataset.hideIntro === "1",
      onReport: (report, answers) => {
        // Hook for analytics, e.g. GA4: gtag("event", "ba_cert_finder", {...})
        el.dispatchEvent(new CustomEvent("bacf:report", { detail: { report, answers }, bubbles: true }));
      },
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
