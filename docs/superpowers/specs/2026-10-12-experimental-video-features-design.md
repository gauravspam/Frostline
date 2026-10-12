# Experimental Video Features: Volume Boost and Ambient Light

Date: 2026-10-12
Status: awaiting review
Path: architectural (new subsystems in the YouTube content-script layer)

## Goal

Add two YouTube-only features behind a collapsible "Experimental Features"
section in the toolbar popup:

1. **Volume Boost** - push YouTube audio past 100% with a single toggle and slider.
2. **Ambient Light** - paint a blurred, colour-matched glow behind the video so
   the letterbox area is not dead black, with one toggle.

Both default to off. Both live in the popup, not in YouTube's own control bar.

## Why this shape

The popup is the single place a Frostline user already looks for Shade and
Theater. Adding a third YouTube-scoped feature to the player's own control bar
would mean a second place to hunt, and YouTube rebuilds that bar often enough
that an injected button there needs a MutationObserver to survive. The popup
needs neither.

Both features are also the kind of thing a user wants available but not active.
Collapsed by default, remembered per install, respects that.

## What was verified before designing

Spiked against the live site in a content-script isolated world, not the main
world, because that is where this code actually runs.

| Question | Result |
| --- | --- |
| Can a content script read YouTube video pixels? | Yes. Drew the live video to a canvas and read `avg=rgb(178,180,155)`. |
| Can a content script create a Web Audio gain node? | Yes. Graph attached and detached cleanly. |
| What state does the AudioContext start in? | `suspended`. Not running. |
| Can `createMediaElementSource` run twice on one element? | No. `InvalidStateError: HTMLMediaElement already connected previously`. |
| What colour is the letterbox? | `rgb(0, 0, 0)`, painted by the player background. |

Two of those findings shaped the whole design. The suspended context and the
one-shot media source are the reason a naive volume booster mutes YouTube, and
the reason half the booster extensions on the store are broken.

## The dimming requirement

The user confirmed from their own screenshots that Ambient Light must dim in
lockstep with the Shade intensity slider, the same way it does when the
competing extension is installed.

This needs no new code. Media-scope Shade already paints with:

```js
img,video,canvas,picture,[style*="background-image"]{filter:brightness(...)!important}
```

If the ambient backdrop is a `<canvas>` element, that rule catches it and the
glow dims automatically. Driving it from the canvas rather than from a CSS
background image is therefore a load-bearing choice, not a stylistic one.

The consequence to document in the UI: **ambient light only dims correctly on
Media scope.** On Page scope, Shade suppresses its overlay under Theater and
the glow would stay bright while everything around it dims. The popup hint must
say so.

## Architecture

### New file: `js/video-fx.js`

A second content script on the same YouTube matches. Not added to
`theater.js`.

`theater.js` is 372 lines and aggressively self-cleaning: it calls `cleanup()`
on every navigation and whenever `cfg.enabled` is false. Volume state must
survive SPA navigation independently of whether Theater is on, and the audio
graph must not be torn down by an unrelated feature going away. A separate file
keeps one clear purpose per unit and avoids coupling the two lifecycles.

Registered in `manifest.json` alongside `theater.js`, same matches, same
`document_idle`.

### State

One new key, `frostline_expCfg`, in `chrome.storage.local`, per the existing
rule that shared state lives in the worker store.

```js
{ volume: 0, volGain: 100, ambient: 0, expOpen: 0 }
```

`volume` and `ambient` are 0 or 1. `volGain` is 100 to 300, clamped on read so a
hand-edited or corrupted value cannot produce an unsafe gain.

No new manifest permissions. YouTube host permissions already exist and Web
Audio needs none.

## Volume Boost

### The two traps, and the fix for each

**Trap 1: the AudioContext starts suspended.** Routing a media element through a
suspended context does not merely fail to boost, it silences the video, because
audio is now flowing into a graph that is not running.

Fix: never touch audio until a genuine user gesture has occurred in the page. A
click inside the toolbar popup is not a gesture in the YouTube document, so it
cannot be relied on. The script listens once for the first `pointerdown` or
`keydown` on the document, and only then creates the context, calls `resume()`,
and builds the graph. Until that moment the video is untouched and plays
normally at 100%.

**Trap 2: `createMediaElementSource` works once per element, forever.** Toggling
off and on can never rebuild the graph. Any code that disconnects and hopes to
recreate is broken.

Fix: one context, one destination, built once and never rebuilt. "Off" is
`gain.gain.value = 1`, never a disconnect. The gain node and its wiring outlive
every toggle.

### Structure

```js
ctx -> limiter -> destination
src(video) -> perGain -> ctx
```

- `limiter` is a `DynamicsCompressorNode` with a high ratio and fast attack.
  Without it, gain above 1 hard-clips at the destination and the result is
  audible distortion rather than louder speech. Three lines, and it is what
  makes a booster sound like a booster.
- `perGain` is per video element, tracked in a `WeakMap`. YouTube's SPA swaps
  the video element between videos, and a new element needs its own
  `MediaElementSource`. On swap, the previous `perGain` is disconnected from the
  context and a new one is created. Disconnecting is fine; only
  `createMediaElementSource` is one-shot.
- `WeakMap` rather than a `Map` so replaced video elements are collectable.

### Range and safety

Default 100%, meaning no change until the user moves the slider. Range 100 to
300, hard clamp in both directions.

Above roughly 150% gain begins distorting audibly even with the limiter, and
sustained high gain risks hearing damage. 300% is the ceiling because past that
the output is distortion, not volume. The popup shows the percentage and marks
anything above 200% as a preview value so the user can see what they picked.

Assumption stated explicitly: this boosts the audio graph only. It does not
raise perceived loudness of the video track or add any normalisation.

## Ambient Light

### Backdrop

A `<canvas class="frostline-amb">` inserted as the first child of
`.html5-video-player`, absolutely positioned to fill it, painted behind the
video layer.

Using a real canvas element rather than a CSS background image is what makes
the Shade coupling work, as described above.

### Sampling

- Source is the live `<video>`.
- Draw into a small offscreen-friendly canvas, 64 by 36. 4096 pixels is enough
  to derive an average colour and costs almost nothing.
- `drawImage` is CORS-clean here because the pixels come from a same-document
  media element, confirmed by the spike.
- Drive with `requestVideoFrameCallback` where available so sampling tracks
  decoded frames instead of polling. Fall back to a throttled timer.
- Throttle repaints to at most one per 100ms regardless of frame rate. The
  backdrop is heavily blurred and scaled, so full frame rate buys nothing
  visible and costs real GPU time.

### Look

Two constants, both named in one place so they can become sliders later without
touching the sampler:

```js
const AMB_BLUR = 25;    // percent, maps to 0 to 120px CSS blur
const AMB_SPREAD = 140; // percent, 100 is exact fit, higher overscans
```

Applied as CSS `filter: blur(...)` and `transform: scale(...)` on the canvas.
Overscan matters: without it the scaled canvas edge is visible inside the
player and reads as a hard line rather than a glow.

### Scope: glow only, no bar cropping

The request originally included black bar removal, black sidebar removal, and
coloured bar detection. This spec ships the glow only.

Those three crop video content, which is a different failure class from
tinting. A wrong glow decision looks slightly off and costs nothing. A wrong
crop decision silently cuts off part of the video, and coloured bar detection
additionally needs a certainty threshold whose failure mode is cutting content
that was never a bar. Fusing them into one toggle means a bad crop takes the
glow down with it.

Bar removal is worth doing later as its own toggle, once its detection is
proven. Not now.

### Interaction with Theater

None required, and this corrects an earlier concern.

Windowed mode pins `#movie_player` as a fixed element over the viewport. The
ambient canvas is a child of that player, so it moves with it and sits behind
the video at a different depth. They are two painted layers, not two filters on
one element, so they do not fight. Under windowed mode the video fills the box
and `object-fit: contain` letterboxes within it, which the glow fills.

Native fullscreen is the one case where ambient stands down, matching how
Theater already stands down for the same reason: both size the same element.

## Popup changes

`popup.html` gains one collapsible section under Theater.

- Header row: "Experimental Features" with a chevron that rotates 90 degrees
  when open. Click anywhere on the header toggles.
- Collapsed state persisted in `frostline_expCfg.expOpen`.
- Inside, two rows matching the existing card styling, using the same `.row`,
  `.tswitch`, `input[type=range]`, and `.val` primitives already in the popup.

```
Experimental Features            v
  Volume Boost          [on/off]
  [========o=====]  150%
  Ambient Light         [on/off]
  Dims with Shade on Media scope.
```

The hint line is required, not decoration. Without it, a user on Page scope
will file the feature as broken.

Volume Boost is inert until a real gesture occurs in the page. The hint text
should say so plainly rather than leaving the toggle looking broken.

## Error handling

Every entry point is wrapped. This script runs on a page we do not control, and
a thrown exception in a content script surfaces as a console error on every
video the user opens.

- No video element: do nothing, retry on `yt-navigate-finish`.
- Canvas context unavailable: disable the ambient toggle, leave Volume alone.
- `AudioContext` construction throws: disable Volume Boost, do not retry in a
  loop. A failed construction must not become a per-frame attempt.
- Gain out of range on read: clamp, never pass through.

## Testing

There is no test suite in this repo, so the diff review is the safety net and
the manual pass is the real check.

Automated, via CDP against the live site in an isolated world:

- Ambient draws and the canvas returns non-uniform pixel data on a playing video.
- Toggle off removes the canvas and stops the sample loop.
- Volume graph attaches on a synthetic gesture, and `gain.value` tracks the
  slider.
- Off sets gain to exactly 1 and does not disconnect.
- A simulated element swap creates a second media source without throwing.
- Shade at 20% and 73% both visibly dim the ambient canvas.

Manual, on a real install:

- Load unpacked, confirm the version label reads the new number.
- Open the popup, expand the section, confirm state survives a popup close.
- Toggle Volume Boost, then click the video. Audio must not be silent at any
  point.
- Toggle Ambient Light on a letterboxed video. Confirm the glow.
- Raise Shade on Media scope and confirm the glow dims with it.
- Navigate between videos and confirm both features survive.
- Enter native fullscreen and confirm ambient stands down cleanly.

## Risks

| Risk | Mitigation |
| --- | --- |
| AudioContext suspended mutes the video | Never touch audio before a real in-page gesture |
| Re-attaching a media source throws | One permanent graph, off means gain 1 |
| Element swap orphans the audio path | WeakMap per element, reconnect on swap |
| Ambient fights Shade on Page scope | Documented in the popup hint |
| Repaint cost on long playback | 64x36 canvas, throttled to 100ms |
| Feature seen as scope creep | Collapsed by default, off by default, own file |