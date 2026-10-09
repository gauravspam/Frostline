# Privacy Policy

**Last updated: 8 October 2026**

Frostline is a browser extension that replaces your new tab page and adds a
screen-shading tool for any page you visit.

## Summary

Frostline does not collect, transmit, sell, or share any personal data. There
is no analytics service, no telemetry, no advertising, and no tracking of any
kind.

## What is stored

All settings you configure are saved in your browser's local storage on your
own device, under keys prefixed `frostline_`. This includes your wallpaper
preference, clock style, weather location, tasks, notes, focus timer state,
calendar settings, saved shortcuts, and GitHub username.

Nothing is uploaded anywhere.

## Optional credentials

If you choose to connect a GitHub account or supply an Unsplash API key, those
values are stored in your browser's local storage on your device. They are sent
only to the service they belong to:

- A GitHub token is transmitted to `api.github.com` so the extension can read
  your profile. If you do not provide one, the extension only reads public data.
- An Unsplash key is transmitted to Unsplash for wallpaper requests. It is
  optional; the extension works without it.

You can remove both at any time by clearing the extension's storage.

## Network requests

Frostline contacts only these services, and only for the features you use:

| Service | Purpose |
| --- | --- |
| `api.open-meteo.com` | Weather data and geocoding |
| `images.unsplash.com` | Wallpaper images |
| `api.unsplash.com` | Wallpaper search, only if you add a key |
| `api.github.com` | GitHub profile activity, only if you set a username |
| `news.google.com` | News headlines |
| `suggestqueries.google.com` | Search suggestions as you type |
| `get.geojs.io` and similar | Approximate city lookup during setup |

No other network requests are made.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Save your settings locally |
| `tabs` | Apply and remove Shade on the page you are viewing |
| `scripting` | Inject the Shade styles and the YouTube theater control |
| `alarms` | Run the scheduled tab-management timer |
| `contextMenus` | Right-click menu entries for discarding tabs |
| `notifications` | Focus timer and GitHub alerts |
| `geolocation` | Optional automatic weather location |
| `system.cpu`, `system.memory` | Local resource checks for tab management |

The extension requests access to all sites (`*://*/*`) because Shade is a
page-level tool that works on any website you choose to shade. It does not read
the content of pages; it only applies a visual filter to the one you ask it to.

## Data deletion

Uninstalling the extension removes all of its local storage. There is no
server-side copy of anything, because there is no server.

## Children

Frostline does not knowingly collect data from anyone, including children.

## Changes

If this policy changes, the updated version will be published in the extension's
repository along with a new release.

## Contact

Questions or concerns: open an issue on the extension's GitHub repository.