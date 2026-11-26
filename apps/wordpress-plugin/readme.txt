=== BA Certification Finder ===
Contributors: techcanvass
Tags: business analysis, certification, cbap, ccba, ecba
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Help visitors find the right Business Analysis path with a short guided advisor.

== Description ==

Add a guided advisor that gives each visitor a personalized Business Analysis career path: a recommended certification, a step-by-step skills roadmap and matching courses. No certification jargon needed.

* Two or three plain-language questions about experience and career goal (a shorter path for people with no BA experience yet).
* Goal-based recommendations: certification, Agile and product ownership, data analytics, technical BA, AI, domain expertise.
* A step-by-step learning roadmap, a "why this recommendation" explanation and an eligibility and scope note.
* Course links with clear labels for primary, also-recommended and optional courses, and links to the official credential issuer where it is not IIBA.
* Loads its script only on pages that use the shortcode, and works with caching/optimisation plugins.
* Mobile-friendly; print/save results.

This tool is an independent guide and is not affiliated with or endorsed by IIBA, Scrum Alliance or Scrum.org. Final eligibility is determined by the certification body.

= Usage =

`[ba_certification_finder]`

Options:

* `hide_intro="yes"` — hide the built-in title and intro (when your page has its own).
* `compact="yes"` — tighter spacing for narrow columns.
* `rules_url="https://…/iiba-rules.json"` — load rules from a hosted file.

= External services =

By default this plugin makes no external requests. If you enter a "Hosted rules URL" in Settings → BA Certification Finder (or the `rules_url` shortcode option), the visitor's browser downloads that JSON file from the URL you set, each time a page with the finder loads. It contains certification thresholds only; no visitor data is sent. The file is hosted by you, so your own site's terms and privacy policy apply.

= Source code and build instructions =

This plugin contains one compiled file, `assets/build/ba-certification-finder.js`. Its complete,
human-readable source is included in the plugin's `source/` folder. That folder holds the
TypeScript/React code, the exact dependency versions in `pnpm-lock.yaml` and step-by-step build
instructions in `source/README.md`. WordPress does not load the `source/` folder.

To rebuild the file (Node.js 20+ and pnpm 10):

`cd source && pnpm install --frozen-lockfile && pnpm build`

Third-party libraries bundled into the compiled file (all MIT licensed):

* React 18.3.1 — https://github.com/facebook/react/tree/v18.3.1/packages/react
* React DOM 18.3.1 — https://github.com/facebook/react/tree/v18.3.1/packages/react-dom
* Scheduler 0.23.2 — https://github.com/facebook/react/tree/v18.3.1/packages/scheduler

== Installation ==

1. In WP Admin go to Plugins → Add New → Upload Plugin, choose the zip and click Install Now. Or upload the `ba-certification-finder` folder to `/wp-content/plugins/`.
2. Activate the plugin.
3. Add `[ba_certification_finder]` to a page (in the block editor, use a Shortcode block).

== Frequently Asked Questions ==

= Is this an official IIBA tool? =

No. IIBA®, BABOK®, ECBA™, CCBA®, CBAP®, CBDA®, AAC® and CPOA are trademarks of the International Institute of Business Analysis. CSPO® is a mark of Scrum Alliance and PSPO is a mark of Scrum.org. This plugin is an independent guide.

= Does it store visitor data? =

No. All checks run in the visitor's browser, and answers are never sent anywhere.

= Can I update the certification rules without updating the plugin? =

Yes. Host a copy of `iiba-rules.json` and enter its URL in Settings → BA Certification Finder. If the hosted file is missing, invalid or older than the bundled one, the plugin falls back to its bundled rules.

== Screenshots ==

1. Question about the visitor's experience.
2. Question about their career goal.
3. Personalized pathway: roadmap, recommended courses and why.

== Changelog ==

= 1.0.0 =
* Initial release.
