# Experimental Video Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Volume Boost and Ambient Light as two off-by-default YouTube features behind a collapsible "Experimental Features" section in the Frostline popup.

**Architecture:** A new content script `js/video-fx.js` runs alongside `theater.js` on the same YouTube matches. It owns one storage key, `frostline_expCfg`. Volume Boost builds one permanent Web Audio graph lazily on the first real in-page gesture. Ambient Light inserts a `<canvas>` backdrop behind the video and repaints it from sampled video pixels. Neither feature talks to the service worker; the popup writes storage and the content script reacts to `chrome.storage.onChanged`, matching how `theater.js` already works.

**Tech Stack:** Vanilla JS, Chrome MV3, Web Audio API, Canvas 2D, `requestVideoFrameCallback`, `chrome.storage.local`. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-10-12-experimental-video-features-design.md`

## Global Constraints

- No build step, no dependencies, no test framework. Files load from disk.
- No new manifest permissions. YouTube host permissions already exist; Web Audio needs none.
- No remote code. No `eval`, no remote scripts, no inline event handlers.
- All shared state in `chrome.storage.local`. Never in `localStorage` inside the content script.
- Comments explain **why**, never **what**. No changelog comments.
- No em dashes anywhere in added lines. The pre-commit hook scans the entire staged diff.
- No `console.log` in shipped code.
- `theater.js` is a content script: self-contained, no imports, no extension API assumptions beyond `chrome.runtime` messaging and `chrome.storage`.
- Ambient Light ships **glow only**. No black bar removal, no sidebar removal, no coloured bar detection.
- Volume Boost is **audio only**. No video-track loudness, no normalisation.
- Volume range is 100 to 300, default 100. Clamp on read.
- Ambient constants: `AMB_BLUR = 25`, `AMB_SPREAD = 140`.

## Testing Approach

This repo has no test suite, so a `pytest`-shaped plan would describe a workflow the project does not have. Every "test" step below is a CDP script that drives **live YouTube** in a content-script **isolated world**, which is the only place this code runs. Harness scripts are throwaway and live outside the repo, in `C:\Users\Admin\AppData\Local\Temp\opencode\`.

Two harness conventions, both learned the hard way in this project:

- **Isolated world, always.** `Page.createIsolatedWorld` then `Runtime.evaluate` with that `contextId`. Testing in the main world proves nothing about a content script.
- **Launch Chrome via `Start-Process` with `--remote-debugging-port`, never `--load-extension`.** Chrome 154 removed it. Kill only test Chrome by matching `opencode` in the command line.

Never kill the user's real browser.

## Review Focus

The spec is a vision document; these are the inputs and conditions it implies but does not spell out. Most likely to bite first.

1. **User enables Volume Boost, then never clicks the page.** AudioContext stays suspended and the graph is never built. Expected: video plays normally at 100%, no silence, toggle simply has no effect yet. Covered in Task 3 Step 3.
2. **User watches a playlist, YouTube swaps the `<video>` element.** New element needs a new `MediaElementSource`. Expected: boost keeps working on the new video, no exception, no orphaned audio path. Covered in Task 3 Step 5.
3. **Shade is on Page scope with Ambient Light on.** Expected: documented degradation, glow stays bright while the page dims. The popup hint must say so. Covered in Task 4 Step 4.
4. **`volGain` in storage is hand-edited to 5000 or set to a string.** Expected: clamp to 300, never pass an out-of-range value to `AudioParam`. Covered in Task 3 Step 4.
5. **User enters native fullscreen with Ambient Light on.** Expected: backdrop stands down cleanly, no leftover canvas, no z-index fight with the player. Covered in Task 2 Step 6.
6. **Content script throws on a page we do not control.** Expected: no console error on any video the user opens. Every entry point wrapped. Covered in Task 1 Step 3.

---

## File Structure

- **Create:** `js/video-fx.js` - both features. One IIFE, two independent sections with a shared storage listener. Owns everything.
- **Modify:** `manifest.json` - register `js/video-fx.js` in `content_scripts`, bump version.
- **Modify:** `popup.html` - collapsible "Experimental Features" section, styles, markup.
- **Modify:** `js/popup.js` - read/write `frostline_expCfg`, wire the two toggles and the slider.

Nothing else changes. `theater.js`, `background.js`, and `theaterCss` are untouched: Ambient Light coexists with Theater as a separate painted layer at a different depth, so no coordination is needed.

---

### Task 1: Content script scaffold and storage contract

Establishes that the script loads on YouTube, reads config, and is silent on the console. Nothing visible yet. If this task cannot get a clean load, every later task is built on sand.

**Files:**
- Create: `js/video-fx.js`
- Modify: `manifest.json` (add content script entry; bump `version` to `0.2`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Storage key `frostline_expCfg`, shape `{ volume: 0|1, volGain: 100..300, ambient: 0|1, expOpen: 0|1 }`.
  - Internal `loadCfg(cb)` reads and clamps, calls `cb(cfg)` with the result.
  - Internal `saveCfg(patch)` merges `patch` into storage and fires the change listener naturally.
  - Global test handle `window.__frostlineFx`, an object whose `cfg` property reflects the last loaded config. Set once at load, updated by `loadCfg`. Harness assertions read this; production code does not use it.

- [ ] **Step 1: Launch test Chrome and confirm the baseline**

```powershell
$udd="C:\Users\Admin\AppData\Local\Temp\opencode\cdpvfx"
Start-Process -FilePath "chrome.exe" -ArgumentList @(
  "--remote-debugging-port=9481","--user-data-dir=$udd","--no-first-run",
  "--no-default-browser-check","--disable-features=OverlayScrollbars",
  "--window-size=1600,900","about:blank")
Start-Sleep -Seconds 7
(Invoke-WebRequest 'http://127.0.0.1:9481/json/version' -UseBasicParsing).StatusCode
```

Expected: `200`. If not, stop and fix the launch before continuing.

- [ ] **Step 2: Write the scaffold**

Create `js/video-fx.js` as an IIFE with the existing project's conventions: the `window.__frostlineThCS` re-entry guard pattern, `isWatchPage()` copied from `theater.js` so both agree on what a watch page is, and `DEF`/`store` shaped like `theater.js`'s config loader.

```js
(function () {
  if (window.__frostlineVidFx) return;
  window.__frostlineVidFx = 1;
  const KEY = 'frostline_expCfg';
  const DEF = { volume: 0, volGain: 100, ambient: 0, expOpen: 0 };
  const clampGain = (v) => {
    const n = typeof v === 'number' && isFinite(v) ? Math.round(v) : 100;
    return Math.min(300, Math.max(100, n));
  };
  let cfg = Object.assign({}, DEF);
  window.__frostlineFx = { cfg: cfg };
  function loadCfg(cb) {
    try {
      chrome.storage.local.get(KEY, (o) => {
        try {
          const raw = (o && o[KEY]) || {};
          cfg = {
            volume: raw.volume ? 1 : 0,
            volGain: clampGain(raw.volGain),
            ambient: raw.ambient ? 1 : 0,
            expOpen: raw.expOpen ? 1 : 0
          };
          window.__frostlineFx.cfg = cfg;
        } catch {}
        if (cb) { try { cb(cfg); } catch {} }
      });
    } catch { if (cb) { try { cb(cfg); } catch {} } }
  }
  function saveCfg(patch) {
    const next = Object.assign({}, cfg, patch || {});
    next.volGain = clampGain(next.volGain);
    next.volume = next.volume ? 1 : 0;
    next.ambient = next.ambient ? 1 : 0;
    next.expOpen = next.expOpen ? 1 : 0;
    cfg = next;
    window.__frostlineFx.cfg = cfg;
    try { chrome.storage.local.set({ [KEY]: cfg }); } catch {}
  }
  loadCfg();
})();
```

Add `js/video-fx.js` to `manifest.json` `content_scripts` as a second entry with the same `matches` and `run_at` as `theater.js`. Bump `version` to `0.2`.

- [ ] **Step 3: Verify a clean load with no console errors**

Write `C:\Users\Admin\AppData\Local\Temp\opencode\vfx1.cjs`. Connect to `9481`, create an isolated world on `https://www.youtube.com/watch?v=aqz-KE-bpKQ`, collect `Runtime.exceptionThrown`, and evaluate in that context:

```js
JSON.stringify({
  handle: typeof window.__frostlineFx,
  cfg: window.__frostlineFx && window.__frostlineFx.cfg,
  gain: window.__frostlineFx && window.__frostlineFx.cfg.volGain
})
```

Expected: `handle` is `"object"`, `cfg.volGain` is `100`, and the collected exception list is empty.

This is Review Focus item 6. If anything throws here, fix it before Task 2.

- [ ] **Step 4: Verify clamping rejects a hostile stored value**

In the same harness, set storage directly and re-read:

```js
chrome.storage.local.set({ frostline_expCfg: { volume: 1, volGain: 5000, ambient: 1, expOpen: 1 } })
```

then call the exposed `loadCfg` and read `cfg.volGain`.

Expected: `300`. This is Review Focus item 4.

- [ ] **Step 5: Commit**

```bash
git add js/video-fx.js manifest.json
git commit -m "Add video-fx content script scaffold with exp config storage"
```

---

### Task 2: Ambient Light glow

The canvas backdrop and its sample loop. Depends only on Task 1's storage contract.

**Files:**
- Modify: `js/video-fx.js` (add the ambient section before the closing `})();`)
- Test: `C:\Users\Admin\AppData\Local\Temp\opencode\vfx2.cjs`

**Interfaces:**
- Consumes: `cfg.ambient` from Task 1, `KEY`, `saveCfg`.
- Produces:
  - DOM node `#frostline-amb`, a `<canvas>` that is the first child of `.html5-video-player`, `position:absolute`, `inset:0`, `pointer-events:none`, behind the video layer.
  - `ambEnsure()` creates the canvas and starts sampling if `cfg.ambient`; returns without throwing when the player is absent.
  - `ambTeardown()` removes the canvas and cancels the loop. Idempotent.
  - Styles are written into the canvas element's own `style.cssText`, not a stylesheet. A content script cannot inject a `<style>` past the page CSP, and `theater.js` gets its CSS from the worker for the same reason. Inline styles on our own element are unaffected by CSP.
  - `AMB_BLUR` percent maps to `blur(AMB_BLUR * 1.2px)`, so 25 gives 30px. `AMB_SPREAD` percent maps to `scale(AMB_SPREAD / 100)`, so 140 gives 1.4.

- [ ] **Step 1: Write the ambient section**

Canvas is 64x36. Sample with `requestVideoFrameCallback` when present, else a 100ms interval. Throttle every repaint to at most one per 100ms regardless of source. Paint by `drawImage(video, 0, 0, 64, 36)` onto the canvas, then let CSS blur and scale it up. Guard `getContext('2d')` returning null by disabling the feature and not retrying in a loop.

Stand down under native fullscreen, matching how `theater.js` stands down for the same reason, since both size the player element:

```js
const nativeFs = () => {
  try { return !!(document.fullscreenElement || document.webkitFullscreenElement); } catch { return false; }
};
```

Insert as **first child** of `.html5-video-player` so it paints behind the video layer. Do not touch `#movie_player` geometry; Theater owns that.

- [ ] **Step 2: Verify the canvas appears and carries live pixels**

In `vfx2.cjs`, set `frostline_expCfg.ambient = 1` in storage, wait for `chrome.storage.onChanged` to land, then in the isolated world evaluate:

```js
(() => {
  const c = document.getElementById('frostline-amb');
  if (!c) return 'NO-CANVAS';
  const x = c.getContext('2d', { willReadFrequently: true });
  const a = x.getImageData(0, 0, 64, 36).data;
  let min = 255, max = 0;
  for (let i = 0; i < a.length; i += 4) { const l = a[i]; if (l < min) min = l; if (l > max) max = l; }
  const cs = getComputedStyle(c);
  return JSON.stringify({ w: c.width, h: c.height, min, max, pos: cs.position, filter: cs.filter.slice(0, 30) });
})()
```

Expected: a canvas exists, `w` is `64`, `h` is `36`, and `max - min` is well above 0. A flat field means the loop never ran.

- [ ] **Step 3: Verify the pixel values change between samples**

Read the average channel value twice, 1500ms apart.

Expected: two different averages on a playing video. Identical values mean the loop sampled once and stopped, which is the failure mode a single read cannot catch.

- [ ] **Step 4: Verify teardown removes the node and stops the loop**

Set `ambient = 0`, wait, then check `document.getElementById('frostline-amb')` is null and that the average no longer changes.

Expected: node gone, average frozen. Then set `ambient = 1` again and confirm the canvas returns, which proves teardown is not destructive.

- [ ] **Step 5: Verify Shade dims the canvas (Review Focus item 3, the requirement itself)**

This is the behaviour the user's screenshots demanded. Drive it end to end: write a `frostline_dimmerCfg` with `scope: 'media'`, `mode: 'dimmer'`, `enabled: 1`, `vals.dimmer: 20`, then repeat at `vals.dimmer: 73`, letting the worker's `dimApply` write the `frostline-sheet-shade` stylesheet each time.

At each intensity, screenshot the player region and compare mean luminance of the backdrop area.

Expected: the 73% frame is measurably darker than the 20% frame, with no change to the video's own pixels beyond the filter. If luminance is identical, the canvas is not matching Shade's `img,video,canvas,picture` selector and the whole approach is wrong.

Use `-D` style capture via `Page.captureScreenshot` in the harness, write PNGs to `C:\Users\Admin\AppData\Local\Temp\opencode\repro\`, then compare with `ffmpeg` or a second `getImageData` pass.

- [ ] **Step 6: Verify fullscreen stand-down (Review Focus item 5)**

Call `document.documentElement.requestFullscreen()` from the isolated world, wait, then check for `#frostline-amb`. Call `exitFullscreen()`, wait, confirm it returns when `ambient` is still 1.

Expected: canvas absent in fullscreen, present again after exit.

- [ ] **Step 7: Commit**

```bash
git add js/video-fx.js
git commit -m "Add ambient light canvas backdrop behind video"
```

---

### Task 3: Volume Boost

The Web Audio graph. The two traps from the spec are the whole design, so read them again before writing this.

**Files:**
- Modify: `js/video-fx.js` (add the volume section)
- Test: `C:\Users\Admin\AppData\Local\Temp\opencode\vfx3.cjs`

**Interfaces:**
- Consumes: `cfg.volume`, `cfg.volGain` from Task 1.
- Produces:
  - Module-level `audio = { ctx: null, limiter: null, dest: null, gains: WeakMap, gestured: false }`.
  - `volArm()` installs the one-shot gesture listener. Safe to call repeatedly.
  - `volBuild(video)` creates `ctx`, `limiter`, and the per-video `MediaElementSource` and `GainNode`. Returns without throwing if `AudioContext` construction fails, and sets `audio.dead = true` so it never retries in a loop.
  - `volApply(video)` sets the per-video gain to `cfg.volGain / 100` when on, or exactly `1` when off.
  - `volTeardown()` is **not** implemented and must not be. Turning off sets gain to 1. There is no disconnect path, by design, because `createMediaElementSource` cannot be called twice on one element.

- [ ] **Step 1: Write the gesture gate**

```js
function volArm() {
  if (audio.gestured || audio.dead) return;
  const go = () => {
    audio.gestured = true;
    document.removeEventListener('pointerdown', go, true);
    document.removeEventListener('keydown', go, true);
    try { volAttach(); } catch {}
  };
  document.addEventListener('pointerdown', go, true);
  document.addEventListener('keydown', go, true);
}
```

A click in the toolbar popup is **not** a user gesture in the YouTube document. This listener is the only thing that unlocks the context, and it is why the toggle appears inert until the user touches the page. That is correct behaviour, and the popup hint in Task 4 must say so.

- [ ] **Step 2: Write the graph builder**

```js
function volAttach() {
  const v = document.querySelector('#movie_player video') || document.querySelector('video');
  if (!v) return;
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { audio.dead = true; return; }
    audio.ctx = new AC();
    audio.limiter = audio.ctx.createDynamicsCompressor();
    audio.limiter.threshold.value = -3;
    audio.limiter.knee.value = 0;
    audio.limiter.ratio.value = 20;
    audio.limiter.attack.value = 0.003;
    audio.limiter.release.value = 0.25;
    audio.limiter.connect(audio.ctx.destination);
  }
  if (audio.ctx.state === 'suspended') { try { audio.ctx.resume(); } catch {} }
  if (audio.gains.has(v)) { volApply(v); return; }
  let src, gain;
  try {
    src = audio.ctx.createMediaElementSource(v);
    gain = audio.ctx.createGain();
  } catch (e) { return; }
  src.connect(gain);
  gain.connect(audio.limiter);
  audio.gains.set(v, gain);
  volApply(v);
}
```

`volApply` reads `cfg.volume` and sets `gain.gain.value` to `cfg.volGain / 100` or exactly `1`.

On element swap, the old `GainNode` is disconnected from the limiter and a new source is built for the new element. That is the one legal disconnect: `createMediaElementSource` is one-shot per element, but `disconnect()` on a gain node is unrestricted.

- [ ] **Step 3: Verify the graph is not built before a gesture (Review Focus item 1)**

In the isolated world, set `volume = 1` in storage. **Without dispatching any input**, evaluate:

```js
(() => {
  const v = document.querySelector('#movie_player video');
  return JSON.stringify({
    vol: v ? v.volume : null,
    ctxExists: !!(window.__frostlineFx.audio && window.__frostlineFx.audio.ctx)
  });
})()
```

Expected: `ctxExists` is `false` and the video's own `volume` is `1`. This is the single most important test in the task. If the graph builds on load, the feature mutes YouTube, which is the bug that breaks most booster extensions.

- [ ] **Step 4: Verify the graph builds on a real gesture and gain tracks the slider**

Dispatch a genuine `Input.dispatchMouseEvent` at the centre of the player via CDP, then set `volGain` to 150 and read:

```js
(() => {
  const a = window.__frostlineFx.audio;
  return JSON.stringify({
    state: a.ctx && a.ctx.state,
    hasLimiter: !!a.limiter,
    gains: a.gains ? 'weakmap' : 'missing'
  });
})()
```

Expected: `hasLimiter` true, `state` becomes `"running"`, and no exception.

- [ ] **Step 5: Verify element swap survives (Review Focus item 2)**

Replace the `<video>` node with a fresh one carrying the same `src`, wait, and confirm `audio.gains.has(newVideo)` is true and `volApply` set its gain. Then toggle `volume` off and on and confirm the gain returns to the slider value **without** a second `createMediaElementSource` call.

The assertion that matters: wrap the swap in a try and confirm zero `InvalidStateError`. That error is the trap the spec exists to avoid.

- [ ] **Step 6: Verify off means gain exactly 1**

Set `volume = 0`, read the gain node's `gain.value`.

Expected: exactly `1`. Never 0, which would silence, and never a disconnect.

- [ ] **Step 7: Commit**

```bash
git add js/video-fx.js
git commit -m "Add volume boost with gesture-gated permanent audio graph"
```

---

### Task 4: Popup section

**Files:**
- Modify: `popup.html` (styles, markup, section)
- Modify: `js/popup.js` (read/write `frostline_expCfg`)
- Test: `C:\Users\Admin\AppData\Local\Temp\opencode\vfx4.cjs`

**Interfaces:**
- Consumes: `KEY` string `frostline_expCfg` and shape from Task 1. Content script Task 2 and Task 3 both listen on it.
- Produces DOM ids: `#exp-head` (clickable header), `#exp-caret` (rotating chevron), `#exp-body` (collapsible body), `#pp-vol-toggle`, `#pp-vol-gain`, `#pp-vol-val`, `#pp-amb-toggle`, `#exp-hint`.

- [ ] **Step 1: Add styles**

Reuse the existing `.card`, `.row`, `.tswitch`, `input[type=range]`, and `.val` primitives. Add only what is new: a header row that is itself clickable, and a chevron that rotates.

```css
.exp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 2px 4px;cursor:pointer;font-size:12px;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.5px}
.exp-head:hover{color:#c7c7cc}
#exp-caret{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s ease;opacity:.7}
.exp-head.open #exp-caret{transform:rotate(90deg)}
#exp-body{max-height:0;overflow:hidden;transition:max-height .22s ease}
#exp-body.open{max-height:320px}
.exp-hint{font-size:11px;color:rgba(255,255,255,.4);margin:8px 2px 0;line-height:1.45}
.exp-title{display:flex;align-items:center;gap:8px}
```

`#exp-caret` must use `transition:transform`, not `height`, so the rotation does not reflow the card.

- [ ] **Step 2: Add markup under the Theater card**

Place inside the existing `.shell`, after the Theater card:

```html
<h1 class="sec exp-head" id="exp-head">
  <span class="exp-title">Experimental Features
    <svg id="exp-caret" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
  </span>
</h1>
<div id="exp-body">
<div class="card">
  <div class="row"><span>Volume Boost</span><span class="rgroup"><button class="tswitch" id="pp-vol-toggle" aria-label="Volume Boost"><i></i></button></span></div>
  <div class="row"><input type="range" id="pp-vol-gain" min="100" max="300" step="5" value="100" /><span class="val" id="pp-vol-val">100%</span></div>
  <div class="row"><span>Ambient Light</span><span class="rgroup"><button class="tswitch" id="pp-amb-toggle" aria-label="Ambient Light"><i></i></button></span></div>
  <p class="exp-hint" id="exp-hint">Volume Boost starts after you click the video. Ambient Light dims with Shade on Media scope.</p>
</div>
</div>
```

The hint is required, not decoration. Without it a user on Page scope files the feature as broken, and a user who has only opened the popup files Volume Boost as broken too.

- [ ] **Step 3: Wire the popup**

Follow the existing `th` pattern: a module-level `exp` object, `expEnsureShape()` that clamps `volGain` identically to the content script, `saveExp()` that writes `localStorage` **and** `chrome.storage.local`, and `paintExp()`.

Write `chrome.storage.local.set({ frostline_expCfg: clean })`. The content script reads that key; `localStorage` in the popup is only for synchronous first paint, matching how `dim` and `th` already work.

`#exp-head` toggles `expOpen` and the `open` class on both `#exp-head` and `#exp-body`. Read `expOpen` at startup and apply it before first paint so the section does not flash open then collapse.

Add a `chrome.storage.onChanged` listener for `frostline_expCfg` that repaints, so toggling from another surface stays in sync.

Values above 200 get the existing `.val.preview` class, so the user can see they picked an aggressive value.

- [ ] **Step 4: Verify the hint text matches reality (Review Focus item 3)**

Read `#exp-hint` text from the popup document and compare against the two documented degradation cases.

Expected: the text names both, the gesture requirement for Volume Boost and the Media-scope requirement for Ambient Light. If either is missing, the feature reads as broken to the user who hits it.

- [ ] **Step 5: Verify persistence across popup close**

Set `expOpen: 1`, `volume: 1`, `volGain: 175` via the popup handlers, close the popup, reopen it, and read the painted state.

Expected: section still open, Volume Boost on, slider at 175.

- [ ] **Step 6: Verify popup size still fits**

The popup is `width:300px` and gains a new card. Load `popup.html` at that width and measure `document.body.scrollHeight` against the 600px Chrome popup maximum.

Expected: under 600. If it overflows, Chrome silently clips the bottom and the Ambient Light row becomes unreachable, which is the same class of bug as the GitHub modal overflow already fixed in 1.4.81.

- [ ] **Step 7: Commit**

```bash
git add popup.html js/popup.js
git commit -m "Add collapsible experimental features section to popup"
```

---

### Task 5: Integration pass

Confirms the two features and the two existing ones coexist. Nothing new is written here unless a check fails.

**Files:**
- Modify: only if a check fails.

**Interfaces:**
- Consumes: everything from Tasks 1 through 4.
- Produces: verification evidence, no new interfaces.

- [ ] **Step 1: Verify both features together with Theater off and on**

Drive every combination of `ambient` and `volume`, with `frostline_ytCfg.enabled` both 0 and 1.

Expected: no exceptions in any of the four combinations. Theater's `cleanup()` must not tear down volume state, which is the entire reason `video-fx.js` is a separate file.

- [ ] **Step 2: Verify SPA navigation between videos**

Navigate across three videos using `Page.navigate` to different `?v=` values on the same origin.

Expected: ambient canvas reattaches, volume graph survives or rebuilds cleanly, `__frostlineFx.cfg` retains `volume` and `volGain`.

- [ ] **Step 3: Verify no console errors across a full session**

Collect `Runtime.exceptionThrown` for the whole session.

Expected: empty. This is the check that matters most for store review, since a content script that throws on every video the user opens is a bad look and a real bug source.

- [ ] **Step 4: Verify the version label**

Load `popup.html` and read `#pp-ver`.

Expected: `v0.2`. A stale build is the documented cause of several previous "still broken" reports, and this label is the check that catches it.

- [ ] **Step 5: Commit if anything changed**

```bash
git add -A
git commit -m "Fix integration issues found in experimental features pass"
```

Skip the commit entirely if the pass is clean.

- [ ] **Step 6: Push and tag**

```bash
git push origin main
git tag v0.2
git push origin v0.2
```

---

## Manual Verification Before Release

Run these on a real install, not headless. The headless harness cannot tell you whether it feels right, only whether it works.

1. `chrome://extensions` -> Reload. Confirm the version reads `0.2`.
2. Open the popup, expand Experimental Features. Toggle **Volume Boost** to 150%.
   Click the video. **Audio must never be silent at any point**, including the moment of the click.
3. Toggle **Ambient Light** on a letterboxed video. Confirm the glow fills the bars.
4. Switch Shade to **Media**, raise intensity 20% then 73%. The glow must visibly dim with it.
5. Raise Shade to **Page** scope. The glow stays bright. This is documented degradation, not a bug.
6. Play a playlist through three videos. Both features must survive every swap.
7. Enter native fullscreen. Ambient stands down. Exit. It returns.
8. Close and reopen the popup. State persists.