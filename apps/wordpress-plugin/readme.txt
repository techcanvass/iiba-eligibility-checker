=== BA Certification Finder ===
Contributors: techcanvass
Tags: business analysis, certification, cbap, ccba, ecba
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Help visitors find the right Business Analyst certification with a guided 3-step finder.

== Description ==

Add a guided finder that suggests ECBA, CCBA, CBAP, CBDA, AAC, CCA or PMI-PBA from a visitor's background and everyday work activities. No certification jargon needed.

* Plain-language questions about experience, background, education and interests.
* 10 everyday work activities mapped to the six BABOK® Guide knowledge areas.
* Counts experience only inside each certification's time window (CCBA 7 years, CBAP 10, PMI-PBA 8).
* Optional precise CCBA/CBAP check with exact hours per knowledge area.
* Shows PD hours, references and contact hours needed at application time, with links to the official certification pages.
* Loads its script only on pages that use the shortcode, and works with caching/optimisation plugins.
* Mobile-friendly; print/save results.

This tool is an independent guide and is not affiliated with or endorsed by IIBA or PMI. Final eligibility is determined by the certification body.

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

= Is this an official IIBA or PMI tool? =

No. IIBA®, BABOK®, ECBA™, CCBA®, CBAP®, CBDA®, AAC® and CCA® are trademarks of the International Institute of Business Analysis. PMI-PBA® is a mark of the Project Management Institute. This plugin is an independent guide.

= Does it store visitor data? =

No. All checks run in the visitor's browser, and answers are never sent anywhere.

= Can I update the certification rules without updating the plugin? =

Yes. Host a copy of `iiba-rules.json` and enter its URL in Settings → BA Certification Finder. If the hosted file is missing, invalid or older than the bundled one, the plugin falls back to its bundled rules.

== Screenshots ==

1. Step 1 — questions about the visitor's background.
2. Step 2 — everyday work activities and experience.
3. Certification matches with status and next steps.

== Changelog ==

= 1.0.0 =
* Initial release.
