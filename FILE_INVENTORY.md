# Frostline File Inventory

Generated against commit `beb7c5b`, extension version `1.4.41`.

## Runtime files

| File | Lines | Role | Touches the reported bugs |
|---|---|---|---|
| `manifest.json` | 48 | MV3 manifest, permissions, content-script match | 5 (host permissions, content script injection) |
| `js/background.js` | 522 | Service worker. Shade CSS engine, Theater CSS engine, both appliers, verification probes | 1, 2, 3, 4, 5 |
| `js/popup.js` | 157 | Toolbar popup. Shade + Theater state, refresh buttons | 1, 2, 3, 4 |
| `js/theater.js` | 350 | YouTube content script. In-player button, tooltip, key handling | 5 |
| `js/app.js` | 615 | Newtab page. Widgets, settings rail, onboarding, backup | none directly |
| `popup.html` | 51 | Popup markup and styles | 4 |
| `newtab.html` | 399 | Newtab markup | none directly |
| `css/style.css` | 589 | Newtab styling only, never injected into YouTube | none |
| `assets/icon{16,48,128}.png` | - | Store and toolbar icons | none |

## Project files

| File | Lines | Role |
|---|---|---|
| `.github/workflows/security.yml` | 85 | Trivy, Gitleaks, Semgrep, CodeQL |
| `.github/dependabot.yml` | 50 | Dependency update PRs |
| `.pre-commit-config.yaml` | 41 | Local commit gates |
| `scripts/check-ai-tells.sh` | 27 | Global guard for the AI-tell patterns |
| `scripts/install-security-tools.sh` | 61 | One-time local tool installer |
| `.gitignore` | 29 | Ignores |
| `PRIVACY.md` | 58 | Store privacy policy |
| `README.md` | 102 | Readme |
| `STORE_LISTING.md` | 116 | Store copy |

## Boundaries worth knowing

`css/style.css` and `newtab.html` are loaded only by the newtab page. They are never
injected into YouTube, so no styling rule in them can cause a YouTube symptom. Any
CSS that reaches a YouTube tab comes from exactly three places:

1. `dimCss()` in `js/background.js`, via `chrome.scripting.insertCSS`
2. `theaterCss()` in `js/background.js`, via `chrome.scripting.insertCSS`
3. `FROSTLINE_TIP_CSS` in `js/background.js`, the tooltip pill

That narrows every visual bug in the screenshots to those three generators plus
`js/theater.js`, which builds DOM rather than CSS.

## Reported issues and where they live

| # | Report | Primary suspect |
|---|---|---|
| 1 | Dim works on Media but not on Page | `dimCss()` page branch in `background.js` |
| 2 | Reader on Media, allowed or not | `dimCss()` media branch, `popup.js` scope handler |
| 3 | Dim and Blur cannot both apply | `dimApply()` exclusive-mode resolution |
| 4 | Refresh button does nothing | `wireRefresh()` in `popup.js`, `dimResetAll()` in `background.js` |
| 5 | Windowed fullscreen blurs and crops after 1-2 uses | `theaterCss()` sizing, interaction with `dimApply()` |