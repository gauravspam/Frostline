# Frostline

A beautiful new tab page built around floating frosted-glass widgets: a live
clock, weather, tasks, a focus timer, notes, a world clock, a calendar, GitHub
activity, and a dock of your own shortcuts.

Frostline also ships two companion tools that work on any site:

- **Shade** — dims, warms, or whitens the current page so you can read without
  glare. Adjustable strength, separate modes, and keyboard shortcuts.
- **YouTube windowed fullscreen** — expands the video to fill your browser window
  and hides the page chrome, so nothing competes with what you are watching.

## Inspired by

Frostline took inspiration from three extensions it does not include code from:

- **Frost — Beautiful New Tab** for the overall layout direction and the
  floating-glass widget aesthetic.
- **YouTube Windowed FullScreen** for the theater behavior on YouTube.
- **Screen Dimmer** for the Shade dimming controls.

Frostline is an independent implementation. No source code or assets were taken
from those extensions.

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder

Then open a new tab.

## Features

**Layout**
- Left floating column: date, weather, tasks, focus timer, GitHub, world clock,
  notes, news
- Center: greeting, frosted clock card, quote of the day with author
- Bottom dock: saved shortcuts with hover magnification, tooltips, and a
  right-click editor
- Everything is independently toggleable in Settings

**Clock**
- Multiple styles including analog and rectangle faces
- 12 or 24 hour, adjustable size

**Weather**
- City search or automatic location
- Current conditions, hourly strip, sun arc, and a 5-day forecast via
  [Open-Meteo](https://open-meteo.com)
- Celsius or Fahrenheit

**Focus timer**
- Pomodoro with auto-cycling, an SVG progress ring, skip, and a completion chime
- Today's and all-time totals

**Tasks**
- Add, complete, and remove
- Auto-grows with content

**Notes**
- Pin, search, and edit

**World clock**
- Search presets, UTC offsets, live dials

**GitHub**
- Public events, recent commits, and a contribution heatmap
- Optional personal access token for private data and notifications

**Calendar**
- 42-cell month grid, month navigation, day-of-year subtitle, year progress
- Holiday markers with country selection
- Next three upcoming events

**Appearance**
- Wallpapers from Unsplash with no API key required, or your own image
- Light and dark wallpaper support
- Accent color sampled automatically from the wallpaper, or set manually
- Frosted-glass surfaces that adapt for contrast

**Shade** (works on any page)
- Dim, warm, and white modes with adjustable strength
- Per-site scope: apply to the page or just the content area
- Keyboard shortcuts to toggle and adjust

**YouTube theater**
- Expands the video to fill the browser window
- Hides related videos, comments, and the masthead
- Toggle with the backtick key; exit with `Escape`
- Remembers your preference per video

## Settings

Background, Display, Weather, Widgets, GitHub, Preferences, and Backup. Backup
exports everything to a JSON file you can restore on another machine.

## Privacy

- All settings live in your browser's `localStorage` under the `frostline_` prefix
- No analytics, no telemetry, no tracking
- Network requests go only to the services you see: Open-Meteo, Unsplash, GitHub,
  and Google News
- The optional GitHub token and Unsplash key are stored locally and never sent
  anywhere except those services

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt+Shift+D` | Toggle Shade |
| `Alt+Shift+↑` | Increase Shade strength |
| `Alt+Shift+↓` | Decrease Shade strength |
| `Alt+Shift+T` | Toggle YouTube windowed fullscreen |
| `` ` `` | Toggle YouTube windowed fullscreen (while watching) |
| `Esc` | Exit windowed fullscreen |

## Project structure

```
manifest.json      extension manifest
newtab.html        new tab page
popup.html         toolbar popup
css/style.css      the floating-glass design system
js/app.js          new tab page logic
js/background.js   service worker (Shade, tab discard, alarms)
js/theater.js      YouTube windowed fullscreen
js/popup.js        toolbar popup logic
assets/            extension icons
```

## Requirements

Chrome or any Chromium-based browser, version 114 or newer.