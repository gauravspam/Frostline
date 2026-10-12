// Frostline experimental video content script (YouTube): Volume Boost and
// Ambient Light. Runs alongside theater.js on the same matches (manifest
// content_scripts) and owns frostline_expCfg, which the popup also writes.
(function () {
  if (window.__frostlineVidFx) return;
  window.__frostlineVidFx = 1;
  const KEY = 'frostline_expCfg';
  const DEF = { volume: 0, volGain: 100, ambient: 0, expOpen: 0 };
  // Storage is user-editable, so clamp on read: nothing out of range may reach an AudioParam.
  const clampGain = (v) => {
    const n = typeof v === 'number' && isFinite(v) ? Math.round(v) : 100;
    return Math.min(300, Math.max(100, n));
  };
  let cfg = Object.assign({}, DEF);
  const audio = { ctx: null, limiter: null, gains: new WeakMap(), gestured: false, dead: false, watch: 0 };
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
  function isWatchPage() {
    try {
      const u = new URL(location.href);
      if (u.hostname.indexOf('youtube.com') >= 0) {
        if (u.pathname === '/watch' || u.pathname.indexOf('/shorts/') === 0) return true;
      }
      if (u.hostname === 'youtu.be' && u.pathname !== '/') return true;
    } catch {}
    return false;
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
  // Ambient Light: a 64x36 canvas smeared across the player and blurred by CSS
  // into a colour-matched glow, so the letterbox area is not dead black. It must
  // be a real canvas element and not a background image: Shade's media rule dims
  // img,video,canvas via a CSS filter, and the glow has to dim in lockstep with
  // the intensity slider.
  // The blur and the canvas are deliberately TWO elements. Shade's media rule is
  // `img,video,canvas,...{filter:brightness(...)!important}` and CSS filter does
  // not compose across rules: the !important brightness on the canvas REPLACES
  // its inline blur() instead of multiplying with it, so a single-element design
  // stops being a glow the moment Shade turns on (hard-edged unblurred
  // rectangle). The wrapper div carries the blur because Shade never matches a
  // div; the canvas carries only the overscan scale. Do NOT "simplify" this back
  // onto one element - that reintroduces the collision.
  // Tuning knobs: AMB_BLUR percent maps to blur(AMB_BLUR * 1.2px), AMB_SPREAD
  // percent maps to scale(AMB_SPREAD / 100). The defaults give 30px and 1.4.
  const AMB_BLUR = 25;
  const AMB_SPREAD = 140;
  const AMB_ID = 'frostline-amb';
  const AMB_WRAP_ID = 'frostline-amb-wrap';
  const amb = { wrap: null, canvas: null, ctx: null, timer: 0, watch: 0, vfc: null, last: 0, dead: false };
  // Fullscreen and the backdrop both size the same player element, so the
  // backdrop stands down whenever native fullscreen is up.
  const nativeFs = () => {
    try { return !!(document.fullscreenElement || document.webkitFullscreenElement); } catch { return false; }
  };
  function ambPlayer() {
    try {
      const p = document.querySelector('.html5-video-player');
      if (p && p.isConnected) return p;
    } catch {}
    return null;
  }
  function ambVideo() {
    try {
      const p = ambPlayer();
      const v = (p && p.querySelector('video')) || document.querySelector('video');
      if (v && v.isConnected) return v;
    } catch {}
    return null;
  }
  function ambStop() {
    if (amb.timer) { clearInterval(amb.timer); amb.timer = 0; }
    if (amb.watch) { clearInterval(amb.watch); amb.watch = 0; }
    if (amb.vfc) {
      try { amb.vfc.v.cancelVideoFrameCallback(amb.vfc.h); } catch {}
      amb.vfc = null;
    }
  }
  // rVFC fires per presented frame and re-arms itself; the 100ms interval is the
  // fallback where rVFC is missing or where there is no video element to arm it
  // on yet. Both paths repaint through ambTick, which throttles to one repaint
  // per 100ms regardless of frame rate.
  function ambArm() {
    if (amb.dead || amb.timer || amb.vfc) return;
    const v = ambVideo();
    if (v && typeof v.requestVideoFrameCallback === 'function') {
      const step = () => {
        amb.vfc = null;
        if (amb.dead || !amb.canvas) return;
        ambTick();
        if (!amb.dead && amb.canvas) ambArm();
      };
      try {
        amb.vfc = { v: v, h: v.requestVideoFrameCallback(step) };
        return;
      } catch {}
    }
    amb.timer = setInterval(ambTick, 100);
  }
  // YouTube re-renders the player within seconds of load and can swap the video
  // element out from under an armed rVFC chain, which then never fires again.
  // The watchdog re-arms a dead chain and re-attaches the backdrop wrapper the
  // SPA carried away; paint rate itself is still rVFC or the 100ms interval.
  function ambWatch() {
    try {
      // Browse pages get no backdrop, so a watch-to-home SPA hop tears down
      // here instead of waiting for the player to be rebuilt. Mirrors the
      // theater.js applyAll/cleanup split.
      if (!isWatchPage()) { ambTeardown(); return; }
      if (amb.dead || !cfg.ambient || nativeFs()) return;
      const p = ambPlayer();
      if (!p) return;
      if (!amb.wrap || !amb.wrap.isConnected || amb.wrap.parentNode !== p) { ambApply(); return; }
      if (!amb.vfc && !amb.timer) ambArm();
    } catch {}
  }
  // The backdrop lives inside the player, so an SPA navigation that swaps the
  // player out takes the wrapper (and its canvas) with it. Ticks notice the
  // disconnect and run the apply path again, which re-attaches under the new
  // player. The wrapper is the inserted node, so the reconnect checks track it.
  function ambTick() {
    try {
      if (amb.dead || !amb.wrap) return;
      if (!amb.wrap.isConnected || !ambPlayer() || nativeFs()) { ambApply(); return; }
      const v = ambVideo();
      if (!v) return;
      // A null context or an element with no decoded frame would throw inside
      // drawImage on every tick, so bail before touching the throttle stamp.
      if (!amb.ctx) return;
      if (!v.videoWidth || !v.videoHeight) return;
      const now = Date.now();
      if (now - amb.last < 100) return;
      // Sample the center 80% of the frame to avoid encoded letterbox bars.
      const sx = v.videoWidth * 0.1;
      const sy = v.videoHeight * 0.1;
      const sw = v.videoWidth * 0.8;
      const sh = v.videoHeight * 0.8;
      amb.ctx.drawImage(v, sx, sy, sw, sh, 0, 0, 64, 36);
      // Stamp only after a successful draw: a failed frame must not consume
      // the next frame's budget or a frozen glow masks itself as working.
      amb.last = now;
    } catch {}
  }
  function ambEnsure() {
    if (amb.dead) return;
    const p = ambPlayer();
    if (!p) return;
    if (!amb.wrap || !amb.wrap.isConnected || amb.wrap.parentNode !== p) {
      ambTeardown();
      try {
        // Two elements, one job each. Shade's media rule targets `canvas` with
        // !important brightness, and CSS filter does not compose across rules,
        // so a blur on the canvas itself would be REPLACED (not layered) the
        // moment Shade turns on. The wrapper carries the blur because Shade
        // never matches a div; the canvas carries only the overscan scale.
        const w = document.createElement('div');
        w.id = AMB_WRAP_ID;
        // Inline cssText, not a <style> element: the page CSP blocks styles a
        // content script injects, but inline styles on our own node survive it.
        // Blur and scale stay in CSS so the backing store can stay at 64x36.
        // width/height 100% is required on BOTH elements: an absolutely
        // positioned replaced element keeps its intrinsic 64x36 box under
        // inset:0 alone.
        w.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;filter:blur(' + AMB_BLUR * 1.2 + 'px)';
        const c = document.createElement('canvas');
        c.id = AMB_ID;
        c.width = 64;
        c.height = 36;
        // The scale is on the canvas, not the wrapper: it is overscan that
        // hides the canvas edge and it must scale the pixels. Scaling the
        // wrapper would scale the blur radius with it and double the smear.
        c.style.cssText = 'width:100%;height:100%;display:block;transform:scale(' + AMB_SPREAD / 100 + ')';
        w.appendChild(c);
        amb.wrap = w;
        amb.canvas = c;
        // The wrapper goes on TOP of the video (last child) so the glow appears
        // on the black letterbox bars. mix-blend-mode: screen makes the color
        // visible on black (screen(black, color) = color) while adding only a
        // subtle tint to the video content. Opacity controls intensity.
        p.appendChild(w);
        w.style.opacity = '0.35';
        w.style.mixBlendMode = 'screen';
        // Make video AND its container background transparent so the glow shows
        // in letterbox areas. YouTube's .html5-video-container often has a bg.
        const v = ambVideo();
        if (v) {
          v.style.backgroundColor = 'transparent';
          amb._hadVideoBg = true;
        }
        const vc = p.querySelector('.html5-video-container');
        if (vc) {
          vc.style.backgroundColor = 'transparent';
          amb._hadContainerBg = true;
        }
      } catch { ambTeardown(); return; }
      try { amb.ctx = amb.canvas.getContext('2d'); } catch { amb.ctx = null; }
      // Fallback: paint a visible color so the glow is visible immediately
      // before the first video frame is captured, or if drawImage fails.
      if (amb.ctx) {
        amb.ctx.fillStyle = '#0a84ff';
        amb.ctx.fillRect(0, 0, 64, 36);
      }
      if (!amb.ctx) {
        // A null 2d context is permanent for this document: disarm so the
        // storage listener cannot fall into a retry loop on every video.
        amb.dead = true;
        ambTeardown();
        return;
      }
    }
    try { ambTick(); } catch {}
    try { ambArm(); } catch {}
  }
  function ambTeardown() {
    try { ambStop(); } catch {}
    const w = amb.wrap;
    // Restore video background if we made it transparent.
    if (amb._hadVideoBg) {
      const v = ambVideo();
      if (v) v.style.backgroundColor = '';
      amb._hadVideoBg = false;
    }
    // Restore container background.
    if (amb._hadContainerBg) {
      const p = ambPlayer();
      if (p) {
        const vc = p.querySelector('.html5-video-container');
        if (vc) vc.style.backgroundColor = '';
      }
      amb._hadContainerBg = false;
    }
    amb.wrap = null;
    amb.canvas = null;
    amb.ctx = null;
    amb.last = 0;
    // Remove the wrapper: that takes the canvas with it, so teardown never
    // leaves a detached canvas behind or has to track two nodes.
    if (w) { try { w.remove(); } catch {} }
  }
  function ambApply() {
    try {
      // Preview players on browse pages must stay untouched, same rule as
      // theater.js applyAll: gate here so enables elsewhere cannot paint.
      if (!isWatchPage()) { ambTeardown(); return; }
      if (cfg.ambient && !nativeFs()) {
        ambEnsure();
        // The watchdog outlives individual canvases so a page the SPA swapped
        // out and back still gets the backdrop re-attached with no user action.
        if (!amb.dead && !amb.watch) amb.watch = setInterval(ambWatch, 500);
      } else ambTeardown();
    } catch {}
  }
  try {
    document.addEventListener('fullscreenchange', ambApply);
    document.addEventListener('webkitfullscreenchange', ambApply);
  } catch {}
  // A click in the toolbar popup is not a gesture in this document, so this
  // listener is the only thing that can ever unlock the AudioContext here.
  // Installed at boot whatever cfg says: volArm refuses to run once the first
  // gesture has passed, so waiting for the toggle to arm it would lose the
  // unlock entirely for users who touch the page before opening the popup.
  function volArm() {
    if (audio.gestured || audio.dead) return;
    const go = () => {
      // No video yet means nothing to wire. The click still counts as the
      // unlock, so record it and keep the listeners: the watchdog builds once
      // the player arrives, and a later click retries directly.
      try {
        const nov = document.querySelector('#movie_player video') || document.querySelector('video');
        if (!nov || !nov.isConnected) {
          audio.gestured = true;
          if (!audio.watch) { try { audio.watch = setInterval(volWatch, 500); } catch {} }
          return;
        }
      } catch {}
      audio.gestured = true;
      document.removeEventListener('pointerdown', go, true);
      document.removeEventListener('keydown', go, true);
      // Run even with volume off: a toggle after this click builds through
      // the watchdog with no second click, and costs one cheap poll.
      if (!audio.watch) { try { audio.watch = setInterval(volWatch, 500); } catch {} }
      // Build only for users who opted in, so everyone else keeps bit-identical
      // audio with no context, no source node, and no compressor in the path.
      try { if (cfg.volume) volAttach(); } catch {}
    };
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
  }
  // YouTube SPA swaps the video element without a config write, so boost
  // would stay wired to a detached node and silently stop on video 2. The
  // watchdog re-attaches the fresh element with no user action, mirroring
  // the ambient 500ms watchdog pattern and interval.
  // Gated on gestured so a context is never built before a real user gesture.
  // Building early would leave it suspended and silence the video, because a
  // routed MediaElementSource stays quiet while its context is suspended.
  function volWatch() {
    try {
      if (!isWatchPage()) return;
      if (!audio.gestured || audio.dead) return;
      // Volume off means no graph, so toggling on later is the only path here.
      if (!cfg.volume) return;
      const v = document.querySelector('#movie_player video') || document.querySelector('video');
      if (!v || !v.isConnected) return;
      // Runs with ctx null on purpose: a toggle after the gesture, or a player
      // that arrived late, builds here with no second click, and a suspended
      // context gets its resume retried on the same tick.
      if (!audio.ctx || !audio.gains.has(v)) volAttach();
    } catch {}
  }
  // The compressor is the limiter. Without it, gain above 1 hard-clips at the
  // destination and louder comes out as distortion instead of volume.
  function volAttach() {
    // Preview players on browse pages must never be routed through a graph.
    if (!isWatchPage()) return;
    const v = document.querySelector('#movie_player video') || document.querySelector('video');
    if (!v) return;
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        // Permanent failure, so drop the watchdog alongside the graph handles.
        audio.dead = true;
        if (audio.watch) { clearInterval(audio.watch); audio.watch = 0; }
        return;
      }
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
    // Start once the graph exists so the watchdog never builds a context on
    // its own. Single instance guard matches amb.watch, so only one runs.
    if (!audio.watch) audio.watch = setInterval(volWatch, 500);
    if (audio.gains.has(v)) { volApply(); return; }
    let src, gain;
    try {
      src = audio.ctx.createMediaElementSource(v);
      gain = audio.ctx.createGain();
    } catch (e) { return; }
    src.connect(gain);
    // No limiter edge here: volApply owns the single connect per gain node,
    // so re-attaching the same element cannot stack a second edge and play
    // the level ~6dB hot. volApply below runs next and wires it exactly once.
    audio.gains.set(v, gain);
    volApply();
  }
  // The gain node currently feeding the limiter. A WeakMap cannot be
  // enumerated, so the live edge is tracked here to know what to unhook when
  // the SPA swaps the video element.
  let volWired = null;
  // Off means gain exactly 1, never 0 and never a disconnect:
  // createMediaElementSource works once per element for the life of the
  // document, so the wiring has to outlive every toggle. An element the SPA
  // replaced gets one legal disconnect here (gain nodes are unrestricted),
  // because a stale edge would keep the old video playing through the graph.
  function volApply() {
    try {
      if (!isWatchPage()) return;
      if (!audio.ctx || !audio.limiter) {
        // The toggle can land after the gesture: build now instead of waiting
        // for another click. Never before a gesture, or the routed source
        // would sit silent on a suspended context.
        if (cfg.volume && audio.gestured) volAttach();
        return;
      }
      const v = document.querySelector('#movie_player video') || document.querySelector('video');
      if (!v) return;
      if (!audio.gains.has(v)) {
        if (cfg.volume && audio.gestured) { volAttach(); return; }
        return;
      }
      const g = audio.gains.get(v);
      if (!g) return;
      if (volWired !== g) {
        if (volWired) { try { volWired.disconnect(audio.limiter); } catch {} }
        try { g.connect(audio.limiter); } catch {}
        volWired = g;
      }
      g.gain.value = cfg.volume ? cfg.volGain / 100 : 1;
    } catch {}
  }
  function refresh() {
    loadCfg(() => {
      try { ambApply(); } catch {}
      try { volApply(); } catch {}
    });
  }
  // The isolated world keeps this handle off the page's global: the page cannot read or call it.
  window.__frostlineFx = { cfg: cfg, loadCfg: loadCfg, saveCfg: saveCfg, audio: audio };
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch[KEY]) refresh();
    });
  } catch {}
  refresh();
  volArm();
})();
