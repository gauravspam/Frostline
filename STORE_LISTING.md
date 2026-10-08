# Chrome Web Store Listing — Frostline

Copy-paste content for the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Item details

**Name** (29/45 characters)
```
Frostline — Beautiful New Tab
```

**Short description** (132/132 characters)
```
A beautiful new tab with floating-glass widgets, focus tools, and daily inspiration. Includes Shade and YouTube windowed fullscreen.
```

**Category:** Productivity

**Language:** English (United States)

---

## Description

```
Frostline turns every new tab into a calm, focused workspace.

Everything floats on a soft frosted-glass layer over a wallpaper you choose, so
the page stays readable without ever feeling heavy. Widgets are yours to arrange:
hide the ones you never use, keep the ones you reach for every day.

BUILT-IN WIDGETS

- Live clock with analog and rectangle faces, 12 or 24 hour
- Weather with current conditions, hourly strip, sun arc, and 5-day forecast
- Tasks that grow as you add to them
- Focus timer with auto-cycling Pomodoro and a completion chime
- Notes with pin, search, and full formatting
- World clock with search, UTC offsets, and live dials
- Calendar with month navigation, year progress, and holiday markers
- GitHub activity with a contribution heatmap
- News headlines
- A dock of your own shortcuts with hover magnification

SHADE

Reading something bright in a dark room? Shade dims, warms, or whitens any page
you are on. Adjust the strength, choose a scope, and use the keyboard to toggle it
without touching the mouse.

YOUTUBE WINDOWED FULLSCREEN

Expand the video to fill your browser window and hide everything else — no
related videos, no comments, no masthead. Toggle it with the backtick key.

WALLPAPERS AND APPEARANCE

No API key needed. Frostline pulls free rotating photos from Unsplash, or you
can upload your own image or pick a solid color. Light and dark wallpapers are
both supported, and the accent color can be sampled automatically from the
wallpaper or set by hand.

DESIGNED TO STAY OUT OF THE WAY

Everything lives in your browser. No account, no analytics, no telemetry, no
ads, no tracking. Your settings, notes, and tasks never leave your device.

KEYBOARD

Alt+Shift+D toggle Shade
Alt+Shift+Up / Down adjust Shade
Alt+Shift+T toggle YouTube windowed fullscreen
` toggle windowed fullscreen while watching
Esc exit windowed fullscreen
```

---

## Privacy practices

Answer these in the dashboard:

| Question | Answer |
| --- | --- |
| Does your extension collect or share user data? | **No** |
| Is all user data encrypted in transit? | **N/A — no user data is transmitted** |
| Do you sell or transfer user data to third parties? | **No** |
| Does your extension use or transmit data for unrelated purposes? | **No** |

Justification to paste if asked: Frostline stores all settings in the browser's
local storage. The only network requests are to the services listed in the
privacy policy (Open-Meteo, Unsplash, GitHub, Google News), and each is required
for a feature the user explicitly configures. Credentials the user chooses to
supply are sent only to their own service.

Attach [`PRIVACY.md`](PRIVACY.md) as the privacy policy.

---

## Permissions justification

Paste this in the "Why does your extension need these permissions?" box:

```
storage    Saves your settings, tasks, notes, and shortcuts on your device.
tabs       Applies and removes Shade on the page you are viewing.
scripting  Injects the Shade styles and the YouTube theater control button.
alarms     Runs the scheduled tab-management timer.
contextMenus  Right-click menu entries for discarding tabs.
notifications   Focus timer completion and GitHub alerts.
geolocation Optional automatic weather location; city search also works.
system.cpu / system.memory   Local resource checks used by tab management.

Host access to all sites is required because Shade is a page-level tool that
works on whichever site you choose to shade. It does not read page content — it
only applies a visual filter to the page you explicitly ask it to affect.
```

---

## Assets

| Asset | File | Status |
| --- | --- | --- |
| Icon 128×128 | `assets/icon128.png` | Ready |
| Small icon 48×48 | `assets/icon48.png` | Generated |
| Tiny icon 16×16 | `assets/icon16.png` | Generated |
| Screenshots 1280×800 or larger | **Needed** | You must capture these |
| Promotional image (optional) | Skipped | |

### Screenshot capture script

Chrome needs five screenshots minimum, each 1280×800 or larger. To capture the
new tab page, install the extension unpacked, open the new tab, and use full-page
screenshots. Suggested subjects:

1. The default layout with all widgets visible
2. A close-up of the dock with a tooltip showing
3. The settings panel open on the Display tab
4. Shade applied over a bright page
5. YouTube windowed fullscreen active

---

## Before you publish

- [x] Manifest name, description, and icons compliant with Web Store limits
- [x] `PRIVACY.md` written
- [ ] Five screenshots at 1280×800+
- [ ] Load the unpacked build once and confirm the new tab loads clean
- [ ] Confirm the extension ID

Because Shade and the YouTube integration touch every page, the store may review
it manually. That is expected for this permission set; the justification above
is written to answer it directly.

### One-time developer fee

Publishing requires a one-time $5 developer registration fee. Create the
listing at https://chrome.google.com/webstore/devconsole.