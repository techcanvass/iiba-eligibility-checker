# Source code for assets/build/ba-certification-finder.js

`assets/build/ba-certification-finder.js` is the only compiled file in this plugin. It is built
with [Vite](https://vite.dev) from the TypeScript/React source in this folder. WordPress never
loads this `source/` folder; it is here so the plugin can be reviewed, studied and rebuilt.

## What is in here

| Folder | Contents |
|---|---|
| `packages/core/` | Certification rules (`rules/iiba-rules.json`) and matching logic (TypeScript) |
| `packages/ui/` | The finder interface (React components) and its styles (`src/styles.css`) |
| `apps/wordpress-plugin/src/wp-entry.tsx` | Mounts the finder wherever the shortcode is used |
| `package.json`, `pnpm-lock.yaml` | Exact versions of every build tool and library |

## Third-party libraries bundled into the compiled file

| Library | Version | License | Source |
|---|---|---|---|
| React | 18.3.1 | MIT | https://github.com/facebook/react/tree/v18.3.1/packages/react |
| React DOM | 18.3.1 | MIT | https://github.com/facebook/react/tree/v18.3.1/packages/react-dom |
| Scheduler (React dependency) | 0.23.2 | MIT | https://github.com/facebook/react/tree/v18.3.1/packages/scheduler |

They are installed from npm at the exact versions pinned in `pnpm-lock.yaml`.

## Rebuild

Requirements: Node.js 20 or newer, and pnpm 10 (`npm install -g pnpm`).

```bash
cd source
pnpm install --frozen-lockfile
pnpm build
```

The result is `apps/wordpress-plugin/assets/build/ba-certification-finder.js`. It is identical to
the file shipped in the plugin's `assets/build/` folder.
