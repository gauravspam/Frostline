# Frostline - Agent Instructions

Chrome extension (Manifest V3). No build step, no test suite, no backend, no dependencies.

## Architecture
- `manifest.json` - single source of truth: permissions, entry points, keyboard commands
- `js/background.js` - service worker: central state store, Shade and Theater mode logic, alarms, message routing
- `js/app.js` - new tab page widgets (clock, weather, tasks, focus timer, news, dock)
- `js/popup.js` - toolbar popup UI; reads and writes the worker store, never local state
- `js/theater.js` - YouTube content script (windowed fullscreen); runs isolated, no access to extension globals
- `newtab.html` / `popup.html` - markup only; `css/` - styles; `assets/` - icons and images
- `scripts/` - dev tooling (commit gate, security installer)
- `.github/workflows/security.yml` - CI: actionlint + zizmor, semgrep, trivy, gitleaks

## Hard rules
- All shared state lives in the background worker store (chrome.storage). Never duplicate state in popup or newtab.
- Service worker can be killed at any moment: no mutable globals, rehydrate from storage on startup.
- `theater.js` is a content script: self-contained, no imports, no extension API assumptions beyond chrome.runtime messaging.
- Do not add permissions to manifest.json without stating why in the response. Each permission increases store review scrutiny.
- No remote code (eval, remote scripts, inline handlers). Instant store rejection.

## Commands
No build: files load directly from disk.
- Manual test: `chrome://extensions` -> Developer mode -> Load unpacked -> open new tab
- All local gates: `pre-commit run --all-files`
- SAST only: `uvx semgrep scan --config auto --error`
- Workflow lint only: `uvx zizmor .github/`
- Manifest JSON validity: `python -m json.tool manifest.json`

## Code style
- Match the style of the file you are editing (files differ in age; follow the local pattern).
- Comments explain why, never what. No changelog comments.
- Minimal diffs: change only what the task requires.

## Verification protocol
After every code change, before responding:
1. Validate `manifest.json` parses.
2. If a workflow changed, run `uvx zizmor .github/`.
3. If JS changed, re-read the diff for runtime errors (this has no test suite - the diff review IS the safety net).
4. State any assumptions made, especially about chrome.* API behavior.
