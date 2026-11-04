import { mount } from "@iiba/ui";
import "@iiba/ui/styles.css";

/**
 * Mounts a finder into every `.iiba-eligibility-root` element the shortcode prints.
 * Settings come from data-* attributes, so several instances can coexist on one page.
 */
function init() {
  document.querySelectorAll<HTMLElement>(".iiba-eligibility-root:not([data-mounted])").forEach((el) => {
    el.dataset.mounted = "1";
    mount(el, {
      rulesUrl: el.dataset.rulesUrl || undefined,
      compact: el.dataset.compact === "1",
      hideIntro: el.dataset.hideIntro === "1",
      onReport: (report, answers) => {
        // Hook for analytics, e.g. GA4: gtag("event", "ba_cert_finder", {...})
        el.dispatchEvent(new CustomEvent("iiba:report", { detail: { report, answers }, bubbles: true }));
      },
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
