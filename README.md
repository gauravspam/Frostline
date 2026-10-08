# Frostline — Beautiful New Tab

1:1 Frost-style recreation (clean-room, for study). Load as unpacked MV3 extension.

## Run
1. `chrome://extensions` → Developer mode → Load unpacked → select this folder (`Frostline`).
2. Open a new tab.

## What it copies (per screenshots + Suite engines)
- Top bar: AI Agents orbit (manageable in Prefs), Google apps grid (13 apps), Full Screen button, Settings gear — visibility in Prefs → UI Options
- Left floating widgets: Date, Weather (Open-Meteo, auto or manual location), Tasks, Focus/Pomodoro, GitHub (live events + optional notifications), World Clock, Notes
- Center: GOOD AFTERNOON greeting, frosted clock card (7 Suite styles in Settings → Display: Analog, Rectangle, Glass, Thin, Outline, Modern, Bold), italic serif quote + author
- Bottom dock: stored shortcuts with gentle hover magnification, tooltips + URL preview, right-click edit/delete, grid opens All Shortcuts modal with add form
- Photo credit pill (bottom-right, Unsplash)
- Calendar: 42-cell grid, month nav, day-of-year subtitle, year progress, holiday dots (India/US), coming-up 3
- Weather: city search, °C/°F, 10-hour strip, sun arc, 5-day (Open-Meteo)
- Pomodoro: auto-cycle engine, SVG ring, skip, beep + notifications, today + all-time totals
- GitHub: public events, compare-enriched pushes, 12-week heatmap, recent 8 commits
- World clock: preset search, UTC offsets, live dials; Notes: pin, search, edit
- Accent color: Auto (sampled saturated from wallpaper) or manual dots
- Settings panel: Background / Display / Weather / Widgets / GitHub / Prefs / Backup, with wired holiday country, weather location/units, GitHub save
- Light + dark wallpaper support via Theme setting + frosted-glass auto contrast
- All data in `localStorage` (`aurora_` prefix). Old task/habit/clock formats auto-migrate. No tracking.

## Structure
- `manifest.json` — MV3 newtab override
- `newtab.html`
- `css/style.css` — floating-glass system
- `js/app.js`, `js/background.js`
- `assets/` — icons / uploads (empty, user content)

## Notes vs original Frost v1.4.0
- Recreation only: no Frost source or assets reused.
- Unsplash wallpapers work with no key (free daily rotation, generic credit). Add your own API key in Settings → Background for fresh random photos.
- GitHub private/notifications need optional PAT in Settings → GitHub; otherwise public profile only.
