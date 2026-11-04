=== BA Certification Finder (IIBA Eligibility Checker) ===
Contributors: techcanvass
Tags: iiba, cbap, ccba, ecba, business analysis
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 2.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Help visitors find the right Business Analyst certification with a guided 3-step finder.

Add a guided finder that suggests ECBA, CCBA, CBAP, CBDA, AAC, CCA or PMI-PBA from a visitor's background and everyday work activities. No certification jargon needed.

* Plain-language questions about experience, background, education and interests.
* 10 everyday work activities mapped to the six BABOK® knowledge areas.
* Counts experience only inside each certification's time window (CCBA 7 years, CBAP 10, PMI-PBA 8).
* Optional precise CCBA/CBAP check with exact hours per knowledge area.
* Shows PD hours, references and contact hours needed at application time, with links to official IIBA and PMI pages.
* Loads its scripts only on pages that use the shortcode.
* Mobile-friendly; print/save results.

This tool is an independent guide and is not affiliated with or endorsed by IIBA or PMI. Final eligibility is determined by the certification body.

= Usage =

`[iiba_eligibility_checker]`

Options:

* `hide_intro="yes"` — hide the built-in title and intro (when your page has its own).
* `compact="yes"` — tighter spacing for narrow columns.
* `rules_url="https://…/iiba-rules.json"` — load rules from a hosted file.

= External services =

By default this plugin makes no external requests. If you enter a "Hosted rules URL" in Settings → IIBA Eligibility (or the `rules_url` shortcode option), the visitor's browser fetches that JSON file from the URL you set. No visitor data is sent.

== Installation ==

1. Upload the `iiba-eligibility-checker` folder to `/wp-content/plugins/`, or install the zip from Plugins → Add New → Upload.
2. Activate the plugin.
3. Add `[iiba_eligibility_checker]` to a page.

== Frequently Asked Questions ==

= Is this an official IIBA tool? =

No. IIBA®, BABOK®, ECBA™, CCBA® and CBAP® are trademarks of the International Institute of Business Analysis. This plugin is an independent guide.

= Does it store visitor data? =

No. All checks run in the visitor's browser.

== Changelog ==

= 2.0.0 =
* New guided 3-step certification finder covering 7 certifications (ECBA, CCBA, CBAP, CBDA, AAC, CCA, PMI-PBA).
* Removed the UTM setting.

= 1.0.0 =
* First release.
