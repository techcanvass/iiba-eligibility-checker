import { defineConfig } from "wxt";

// One codebase → Chrome, Edge (same zip as Chrome) and Firefox.
// `wxt zip` builds Chrome MV3; `wxt zip -b firefox` builds Firefox with gecko settings.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3, // MV3 for every browser, including Firefox
  manifest: ({ browser }) => ({
    name: "BA Certification Finder: ECBA, CCBA, CBAP",
    short_name: "BA Cert Finder",
    description:
      "Find your best-fit Business Analyst certification: ECBA, CCBA, CBAP, CBDA, AAC, CCA or PMI-PBA, based on the work you do.",
    homepage_url: "https://www.techcanvass.com",
    // No permissions: everything runs inside the popup. Minimal permissions = faster store review.
    permissions: [],
    action: { default_title: "Find my BA certification" },
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          id: "iiba-eligibility-checker@techcanvass.com",
          strict_min_version: "140.0",
          // Required for new AMO submissions. This extension collects nothing.
          data_collection_permissions: { required: ["none"] },
        },
      },
    }),
  }),
});