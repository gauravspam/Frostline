# Diagnosed Issues (commit beb7c5b)

## Issue 1: "Dim works on Media but won't work on Page"
**Root cause**: CSS generation is correct (see diag1 output). The page-scope dim generates:
- `--frostline-ov-bg: linear-gradient(rgba(0,0,0,0.76)...)`
- `::before` with `background:var(--frostline-ov-bg)` and `backdrop-filter:blur(var(--frostline-ov-blur))`

**Why user sees it as "not working"**: The probe `dimProbe` reports a false positive mismatch because it checks `video.filter !== 'none'` which catches YouTube's own video filters (HDR, ambient mode, etc.). The red warning flag makes the user think Dim is broken when it's actually working.

## Issue 2: "Reader mode on Media - allowed or not?"
**Root cause**: `dimCss` media branch explicitly supports Reader (lines 126-128):
```js
if(active==='reader') f+=' sepia('+(amt*0.6).toFixed(2)+') saturate('+(1-amt*0.35).toFixed(2)+')';
```
**UI**: `popup.js` allows any mode to use Media scope. This is currently intentional but confusing.

## Issue 3: "Can't apply Dim and Blur together"
**Root cause**: **By design** - Shade modes are mutually exclusive (background.js:86-90). Only the active mode paints. The UI shows the stored value for each mode, but switching modes swaps the active effect.

**User confusion**: Clicking Dim button shows Dim's stored value (preview), but Blur is still the active mode. This is a UI affordance issue.

## Issue 4: "Refresh button does nothing"
**Two bugs found**:
1. **False positive mismatch** (same as Issue 1): `dimMismatch` flags `media=true` when YouTube's video has ANY filter. The reset runs but verify immediately re-flags.
2. **`dimResetAll` and disable path don't re-add `frostline-ov` class**: They remove the class, insert `DIM_NEUTRAL` (which targets `html.frostline-ov`), but never add the class back. So the neutral rules don't match.

## Issue 5: "Windowed fullscreen blurs and crops after 1-2 uses"
**Blur**: Likely the same false positive from Shade's media-scope probe, OR leftover Shade CSS because verification doesn't run on YouTube SPA navigation.
**Crop**: Theater CSS uses `inset:0` on fixed `#movie_player` - correct. Cropping happens when viewport aspect ≠ 16:9. The player fills the viewport box, clipping video that overflows. This is expected behavior for "windowed fullscreen" - it fills the window, not the video.

---

# Fix Plan

| File | Changes |
|---|---|
| `js/background.js` | 1. Make `dimProbe`/`theaterProbe` check for Shade/Theater-specific signatures only<br>2. Fix `dimResetAll` and disable path to re-add `frostline-ov` class after inserting neutral CSS<br>3. Add verification on YouTube navigation (SPA) via MutationObserver or `webNavigation` API |
| `js/popup.js` | 1. Show stored values as "preview" not "active" when mode ≠ edit<br>2. Disable Media scope for Reader (or add warning) |
| `js/theater.js` | 1. Ensure `frostlineTheaterOff` cleans up all state |
| `popup.html` | 1. Visual distinction between active mode and preview values |

---

## Immediate Fixes (no UI redesign)

### 1. Fix probe false positive
Change `dimMismatch` to check for Shade-specific filter signatures:
- Media scope: look for `brightness(...) sepia(...) blur(...)` pattern, not any filter
- Page scope: check `--frostline-ov-blur > 0` and `::before` display !== 'none' (already done)

### 2. Fix missing class re-add
In disable path and `dimResetAll`: after inserting `DIM_NEUTRAL`, re-add `frostline-ov` class.

### 3. Fix YouTube SPA verification
Add `webNavigation.onCompleted` listener for YouTube URLs to re-verify.

### 3b. Fix Theater probe false positive
Check for `frostline-th-wfs` class and fixed player, not generic blur.

### 4. Fix dimResetAll class re-add
Add `h.classList.add('frostline-ov')` after inserting neutral CSS.