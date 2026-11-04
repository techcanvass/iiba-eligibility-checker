# IIBA Eligibility Checker

Check eligibility for IIBA **ECBA**, **CCBA** and **CBAP** — one rules engine, shipped to five platforms:

| Platform | Folder | Output |
|---|---|---|
| Chrome + Microsoft Edge | `apps/browser-extension` | `browser-extension-2.0.0-chrome.zip` (same zip for both stores) |
| Firefox | `apps/browser-extension` | `browser-extension-2.0.0-firefox.zip` + `-sources.zip` |
| WordPress | `apps/wordpress-plugin` | `iiba-eligibility-checker.zip` (upload via Plugins → Add New) |
| Discord | `apps/discord-bot` | `/iiba-eligibility` slash command |
| Web | `apps/web-app` | Static site in `dist/` (also hosts `iiba-rules.json`) |

```
packages/core   → rules + logic (pure TypeScript, no DOM, no platform code)
packages/ui     → React form + result, shared by extension, WordPress and web app
apps/*          → thin wrappers per platform
```

**The one rule:** `packages/core` never imports anything browser-, Discord- or WordPress-specific.

---

## Requirements

- Node.js 22.9+ (the Discord bot uses Node's `--env-file-if-exists`)
- pnpm 9+ → `npm i -g pnpm`
- PHP 7.4+ (only to run the WordPress smoke test)

## Quick start

```bash
pnpm install
pnpm test          # 38 unit tests (core + Discord command)
pnpm typecheck
pnpm dev:web       # open http://localhost:5173
```

Build everything:

```bash
pnpm build         # tests → typecheck → web app → extension zips → WordPress bundle
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
| WordPress | Settings → IIBA Eligibility → Hosted rules URL |
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
pnpm zip                 # → .output/browser-extension-2.0.0-chrome.zip
pnpm zip:firefox         # → .output/browser-extension-2.0.0-firefox.zip (+ sources zip for AMO)
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
pnpm package             # → dist/iiba-eligibility-checker.zip
php tests/smoke-test.php # 15 checks: hooks, shortcode output, escaping, sanitizing
```

Install: WP Admin → Plugins → Add New → Upload Plugin → choose the zip → Activate.

Use on any page (works in Gutenberg's Shortcode block and Kadence):

```
[iiba_eligibility_checker]
[iiba_eligibility_checker hide_intro="yes"]   (page already has its own H1/intro)
[iiba_eligibility_checker compact="yes"]      (tighter spacing for narrow columns)
```

Scripts and CSS load **only** on pages with the shortcode (no PageSpeed cost elsewhere). All CSS is scoped under
`.tc-finder` with `tc-` class names, so the theme can't restyle the finder and the finder can't restyle the theme.
One exception: if a theme styles buttons or inputs with `!important`, that rule wins (no plugin can beat it without
breaking the theme). Add an override in Appearance → Customize → Additional CSS if you see that.

Analytics hook — every result fires a DOM event:

```js
document.addEventListener("iiba:report", (e) => {
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
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── eligibility.ts     checkEligibility() — the main entry point
│   │   │   ├── calculator.ts      job history → hours, PD filter, projection
│   │   │   ├── validation.ts      input validation + rules schema guard
│   │   │   ├── rules-loader.ts    hosted rules with safe fallback
│   │   │   ├── dates.ts           UTC date helpers (no timezone drift)
│   │   │   └── types.ts
│   │   ├── rules/iiba-rules.json  ← edit this when IIBA changes a rule
│   │   └── tests/
│   └── ui/src/                    EligibilityChecker, Form, Result, styles.css
├── apps/
│   ├── browser-extension/         WXT → Chrome, Edge, Firefox
│   ├── wordpress-plugin/          PHP shortcode + settings page + bundled JS
│   ├── discord-bot/               discord.js slash command
│   └── web-app/                   Vite site
├── scripts/                       copy-rules.mjs, make-icons.py
├── store-assets/listing.md        store listing copy
├── PRIVACY.md
└── .github/workflows/ci.yml
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
