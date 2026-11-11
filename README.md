# BA Certification Finder (IIBA Eligibility Checker)

Finds the right Business Analyst certification (ECBA, CCBA, CBAP, CBDA, AAC, CCA, PMI-PBA). The
logic is written **once** and shipped to every platform:

| Platform | Folder | Output |
|---|---|---|
| Chrome + Microsoft Edge | `apps/browser-extension` | `browser-extension-1.0.0-chrome.zip` (same zip for both stores) |
| Firefox | `apps/browser-extension` | `browser-extension-1.0.0-firefox.zip` + `-sources.zip` |
| WordPress | `apps/wordpress-plugin` | `dist/ba-certification-finder.zip` |
| PyPI (Python) | `apps/python-package` | `dist/*.whl` + `dist/*.tar.gz` → `pip install ba-certification-finder` |
| Google Workspace (Sheets, Docs, Slides) | `apps/google-workspace` | Apps Script project in `dist/` → `clasp push` |
| Discord | `apps/discord-bot` | `/iiba-eligibility` slash command |
| Web | `apps/web-app` | Static site in `dist/` (also hosts `iiba-rules.json`) |

## Where the logic lives (the one rule)

```
packages/core/rules/iiba-rules.json   ← questions, options, activities, certifications, IIBA/PMI rules
packages/core/src/*.ts                ← matching logic
packages/ui/src/*                     ← screens and styles
        │
        ├── imported directly ──► web app · browser extension · WordPress plugin · Discord bot
        │
        └── pnpm build:core ──► packages/core/dist/ba-core.js   (one standalone JS file)
                                  ├── copied into ──► Python package   (runs inside V8 via mini-racer)
                                  └── copied into ──► Google Apps Script project (runs in Apps Script V8)
```

**Never write certification logic inside `apps/`.** The apps only connect the core to a platform.
The Python package and the Apps Script add-on contain no logic of their own: they run the exact
compiled core file.

**Proof it stays identical:** `packages/core/tests/conformance/` holds 28 shared cases with their
expected answers. They are replayed against:
- the TypeScript source (`pnpm test`)
- the built bundle and the Apps Script project (`pnpm verify:bundles`)
- the Python package (`pytest`)

If any platform gives a different answer, its check fails. After an **intentional** logic change,
run `pnpm golden` to record the new answers, then commit them.

---

## Requirements

- Node.js 22.9+ and pnpm 9+ (`npm i -g pnpm`)
- PHP 7.4+, only to run the WordPress smoke test
- Python 3.10+, only to test and build the PyPI package

## Quick start

```bash
pnpm install
pnpm test          # core + golden cases + Discord + Apps Script tests
pnpm dev:web       # open http://localhost:5173
```

Build everything:

```bash
pnpm build         # tests → typecheck → core bundle → web, extension, WordPress, Workspace, Python sync → verify
```

---

## What it does

**Web app, browser extension and WordPress plugin** show a guided 3-step *BA Certification Finder*
(Techcanvass design v3):

1. **About you**: experience, background, education, interest.
2. **Your work**: 10 everyday activities (mapped to the 6 BABOK knowledge areas), years, share of time,
   career breaks and how recently the person did this work.
3. **Matches**: 7 certifications (ECBA, CCBA, CBAP, CBDA, AAC, CCA, PMI-PBA), ordered by interest, each with
   a status pill and next steps. An optional section takes exact CCBA/CBAP hours and per-area hours for a
   precise check.

| | ECBA | CCBA | CBAP | PMI-PBA |
|---|---|---|---|---|
| Experience | none | 3,750 hrs in last 7 yrs | 7,500 hrs in last 10 yrs | 24 / 36 / 60 months in last 8 yrs (GAC / bachelor's / secondary) |
| Knowledge areas | — | 900+ in 2 **or** 500+ in 4 | 900+ in 4 of 6 | — |
| Application stage | — | 21 PD hrs + 2 references | 35 PD hrs + 2 references | 35 contact hours |

CBDA, AAC and CCA are knowledge-based (no experience threshold).

How the indicative estimate works: years of activity × share of time × 1,600 hrs/year, **counting only the
years that can fall inside each certification's window**. For example, someone who stopped BA work 2–7 years
ago can't have more than 5 years inside CCBA's 7-year window. Exact hours entered in the optional section
always take precedence over the estimate.

**Discord** keeps the quick hours-based check (`/iiba-eligibility`), which uses the same rules file.

### ⚠️ Keep the rules current

All thresholds live in **`packages/core/rules/iiba-rules.json`**. Before each release, check them against the
current IIBA Core BA Certification Handbook on iiba.org. Fields listed under `toVerify` (CCBA KA split,
references) vary between third-party sources — confirm them first.

**Hosted rules (recommended):** `pnpm build:web` copies the rules to `apps/web-app/dist/iiba-rules.json`.
Host it (e.g. `https://www.techcanvass.com/tools/iiba-rules.json`) and point each platform at it:

| Platform | Where to set the URL |
|---|---|
| Web app | `VITE_RULES_URL` in `apps/web-app/.env` |
| WordPress | Settings → BA Certification Finder → Hosted rules URL |
| Discord | `RULES_URL` in `apps/discord-bot/.env` (re-fetched every 6 hours) |
| Extension | `RULES_URL` in `entrypoints/popup/main.tsx` + serve the file with `Access-Control-Allow-Origin: *` |

Bump `version` in the JSON when you change it. Clients ignore a remote file that is older than their bundled copy
or fails schema validation, so a bad upload can't break the tool.

---

## Browser extension (Chrome, Edge, Firefox)

```bash
cd apps/browser-extension
pnpm dev                 # Chrome with hot reload
pnpm dev:firefox         # Firefox
pnpm zip                 # → .output/browser-extension-1.0.0-chrome.zip
pnpm zip:firefox         # → .output/browser-extension-1.0.0-firefox.zip (+ sources zip for AMO)
npx web-ext lint --source-dir .output/firefox-mv3   # same linter AMO runs
```

Load unpacked to test: Chrome → `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.

**Icons:** `public/icon/*.png` are placeholders. Replace with the Techcanvass logo (16, 32, 48, 96, 128 px)
or edit and re-run `python3 scripts/make-icons.py apps/browser-extension/public/icon`.

The extension requests **no permissions**, which makes store review faster.

### Publish

| Store | Account | Steps |
|---|---|---|
| **Chrome Web Store** | One-time $5 fee at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) | New item → upload chrome zip → listing from `store-assets/listing.md` → privacy policy URL → Privacy tab: "does not collect user data" → Submit |
| **Edge Add-ons** | Free, [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) | Create new extension → upload the **same** chrome zip → reuse listing → Submit |
| **Firefox (AMO)** | Free, [addons.mozilla.org](https://addons.mozilla.org/developers/) | Submit a New Add-on → "On this site" → firefox zip → upload `-sources.zip` when asked (bundled code) → listing → Submit |

Updates: bump `version` in `apps/browser-extension/package.json`, rebuild, upload the new zip to each store.

Screenshots: stores want 1280×800 (Chrome/Edge) — screenshot the popup or the web app at that size.

---

## WordPress plugin

```bash
cd apps/wordpress-plugin
pnpm package             # → dist/ba-certification-finder.zip
php tests/smoke-test.php # 27 checks incl. the metadata WordPress.org Plugin Check enforces
```

Install: WP Admin → Plugins → Add New → Upload Plugin → choose the zip → Activate.

Use on any page (works in Gutenberg's Shortcode block and Kadence):

```
[ba_certification_finder]
[ba_certification_finder hide_intro="yes"]   (page already has its own H1/intro)
[ba_certification_finder compact="yes"]      (tighter spacing for narrow columns)
```

Scripts and CSS load **only** on pages with the shortcode (no PageSpeed cost elsewhere). All CSS is scoped under
`.tc-finder` with `tc-` class names, so the theme can't restyle the finder and the finder can't restyle the theme.
One exception: if a theme styles buttons or inputs with `!important`, that rule wins (no plugin can beat it without
breaking the theme). Add an override in Appearance → Customize → Additional CSS if you see that.

Analytics hook — every result fires a DOM event:

```js
document.addEventListener("bacf:report", (e) => {
  const { report, answers } = e.detail;
  gtag("event", "ba_cert_finder", { top_match: report.matches[0].code, interest: answers.interest });
});
```

### Publish to WordPress.org (optional)

1. Create a wordpress.org account → [Add your plugin](https://wordpress.org/plugins/developers/add/) → upload the zip.
2. Manual review (usually 1–10 days). Reviewers check escaping, sanitizing, GPL licence and the readme.
3. On approval you get SVN access: commit to `trunk/`, tag a release in `tags/1.0.0/`.
4. Add banner/icon images to the SVN `assets/` folder.

Ship the **source** too (`apps/wordpress-plugin/src` + `packages/`) or link to a public repo — WordPress.org
requires human-readable source for minified JS.

---

## Python package (PyPI)

The package `ba-certification-finder` gives Python users the same finder, as a library and as the
`ba-cert-finder` command. It runs the shared core (`ba-core.js`) inside Google's V8 engine (the
`mini-racer` dependency, prebuilt for Windows, macOS and Linux).

**Build and test locally** (PowerShell: use `.venv\Scripts\activate` instead of `source …`):

```bash
pnpm build:py                       # builds the core and copies it into the package
cd apps/python-package
python -m venv .venv && source .venv/bin/activate
pip install -e ".[test]" build twine
pytest -q                           # 51 tests, incl. the 28 golden cases
ba-cert-finder                      # try the guided finder
python -m build                     # → dist/*.whl and dist/*.tar.gz
twine check dist/*
```

### Publish to PyPI

**First time** (uses PyPI Trusted Publishing, so no password or token is stored anywhere):
1. Create an account on **pypi.org** and turn on two-factor authentication.
2. Go to **Account → Publishing → Add a new pending publisher** and enter:
   - PyPI project name: `ba-certification-finder`
   - Owner and repository: your GitHub repo
   - Workflow: `publish-pypi.yml`
   - Environment: `pypi`
3. On GitHub, go to **Settings → Environments → New environment** and name it `pypi`. Under
   **Required reviewers**, add yourself, so nothing publishes without your click.

**Each release:**
1. Bump `version` in `apps/python-package/pyproject.toml`, for example to `1.0.1`. Commit and push.
2. Create the tag `py-v1.0.1` and push it. In GitHub Desktop: **History → right-click the commit →
   Create Tag**, then push.
3. Under **Actions → Publish to PyPI**, approve the run. It tests, checks that the tag matches the
   version, and uploads.

To practise first, use **test.pypi.org** with the same steps (environment `testpypi`), or upload
manually: `twine upload --repository testpypi dist/*`.

---

## Google Workspace add-on (Sheets, Docs, Slides)

This is an editor add-on that adds **Extensions → BA Certification Finder → Open**, which shows
the same finder screens in a sidebar. In Google Sheets it also adds two formulas:

| Formula | Result |
|---|---|
| `=BA_ELIGIBILITY(B2, C2, D2:I2)` | `CBAP`, `CCBA`, `ECBA` or `Not yet eligible` |
| `=BA_ELIGIBILITY(B2:B50, C2:C50, D2:I50)` | One result per row, for a whole team sheet |
| `=BA_ELIGIBILITY_DETAILS(B2, C2, D2:I2)` | A table: certification, eligible, what's missing |

The arguments are BA hours (last 10 years), PD hours (last 4 years), and optionally 6 cells of hours
per knowledge area in this order: Planning, Elicitation, Life Cycle, Strategy, Requirements
Analysis & Design, Solution Evaluation. Formulas assume the ethics agreement.

```bash
pnpm build:gws        # → apps/google-workspace/dist/ (appsscript.json, Code.js, Core.js, Sidebar.html)
```

`Core.js` is an exact copy of `packages/core/dist/ba-core.js`, and `Code.js` is a thin wrapper.

### Try it in your own Google account (no publishing)

**One time:**
1. Go to **script.google.com → New project**. Under **Project Settings**, copy the **Script ID**.
2. Copy `apps/google-workspace/.clasp.json.example` to `.clasp.json` and paste the Script ID into it.
3. Run `npx clasp login`.
4. Turn on the Apps Script API at script.google.com/home/usersettings.

**Each time:** run `pnpm --filter google-workspace push`. This builds and uploads the project.

**To test:** in the Apps Script editor, go to **Deploy → Test deployments → Editor add-on**,
choose a test Sheet or Doc, then open it and use **Extensions → BA Certification Finder**.

### Publish to the Google Workspace Marketplace

1. **Create a standard Google Cloud project.** The default project Apps Script creates can't be
   used for publishing. In the Apps Script **Project Settings**, switch to the new project.
2. **Configure the OAuth consent screen** in that Cloud project. The add-on only asks for
   `script.container.ui`, which allows showing the sidebar.
3. **Create a version** of the script: **Deploy → Manage deployments → New version**. Note the
   version number.
4. **Enable the Google Workspace Marketplace SDK.** In **App Configuration**, choose
   **Editor add-on**, enter the script ID and version number, and tick Sheets, Docs and Slides.
5. **Fill in the Store Listing** (description, icons, screenshots, privacy policy URL) and submit.
   - **Public listings** are reviewed by Google.
   - **Private listings** (your organisation only) skip review.
   - This visibility choice can't be changed later.

**To update:** push the code, create a new version, then enter the new version number in the
Marketplace SDK App Configuration.

---

## Discord bot

```bash
cd apps/discord-bot
cp .env.example .env     # fill in DISCORD_TOKEN and DISCORD_CLIENT_ID
pnpm register            # registers /iiba-eligibility (set DISCORD_GUILD_ID for instant testing)
pnpm start
```

Setup in the [Discord Developer Portal](https://discord.com/developers/applications):

1. New Application → **Bot** → Reset Token → copy into `.env`.
2. **General Information** → copy Application ID into `DISCORD_CLIENT_ID`.
3. **Installation** → scopes `bot` + `applications.commands` → copy the install link → add to your server.
4. No privileged intents needed (it uses slash commands only).

Replies are ephemeral — only the person who ran the command sees their hours.

**Hosting:** any always-on Node host (Railway, Render, Fly.io, a small VPS). Example with PM2 on a VPS:
`pnpm install && pm2 start "pnpm --filter discord-bot start" --name iiba-bot`.

**Discovery:** share the install link (Developer Portal → Installation) in BA communities. To be listed in
Discord's App Directory, check the current requirements under the app's **App Directory** tab — they include
app verification and a privacy policy / terms URL (use `PRIVACY.md`).

---

## Project layout

```
iiba-eligibility-checker/
├── packages/                      ★ the only place to edit logic, wording and design
│   ├── core/
│   │   ├── rules/iiba-rules.json  questions, options, activities, certifications, rules
│   │   ├── src/                   finder.ts, eligibility.ts, calculator.ts, validation.ts …
│   │   ├── tests/conformance/     28 shared cases + expected answers (all platforms)
│   │   └── dist/ba-core.js        built standalone core (for Python and Apps Script)
│   └── ui/src/                    CertificationFinder.tsx, styles.css
├── apps/                          thin wrappers, no logic
│   ├── browser-extension/         Chrome, Edge, Firefox (WXT)
│   ├── wordpress-plugin/          PHP shortcode + bundled finder
│   ├── python-package/            PyPI: ba-certification-finder (library + CLI)
│   ├── google-workspace/          Apps Script editor add-on (Sheets, Docs, Slides)
│   ├── discord-bot/               /iiba-eligibility slash command
│   └── web-app/                   standalone page
├── scripts/                       update-golden.mjs, verify-bundles.mjs, copy-rules.mjs …
├── store-assets/                  listing text, screenshots, WordPress.org images
└── .github/workflows/             ci.yml (every push), publish-pypi.yml (on py-v* tags)
```

## Using the core directly

```ts
import { checkEligibility, BUNDLED_RULES } from "@iiba/core";

const report = checkEligibility(
  {
    jobs: [{ start: "2021-04-01", hoursPerWeek: 40, baPercent: 80 }],
    pdEntries: [{ hours: 35, completedOn: "2026-02-10", type: "course" }],
    kaHours: { elicitation: 1500, radd: 1200, planning: 900, strategy: 900 },
    agreesToEthics: true,
  },
  BUNDLED_RULES,
);

report.recommended;                 // "CCBA"
report.results[2].requirements;     // per-rule met / gap
report.results[2].projectedEligibleOn; // "2028-…"
```

---

IIBA®, BABOK®, ECBA™, CCBA® and CBAP® are trademarks of the International Institute of Business Analysis.
This tool is an independent guide and is not affiliated with or endorsed by IIBA.
