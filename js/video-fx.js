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
      const p = document.getElementById('movie_player');
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
      if (!amb.wrap || !amb.wrap.isConnected || amb.wrap.parentNode !== ambHost()) { ambApply(); return; }
      ambSyncRect();
      if (!amb.vfc && !amb.timer) ambArm();
      try { console.log('[Frostline Ambient] Watchdog tick, wrap connected:', amb.wrap?.isConnected, 'cfg.ambient:', cfg.ambient); } catch {}
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
      // Keep the overlay glued to the player across scroll, resize and SPA
      // layout shifts. Runs ahead of the draw so a moved player never shows
      // one stale frame in the wrong place.
      ambSyncRect();
      const v = ambVideo();
      if (!v) return;
      // A null context or an element with no decoded frame would throw inside
      // drawImage on every tick, so bail before touching the throttle stamp.
      if (!amb.ctx) return;
      if (!v.videoWidth || !v.videoHeight) return;
      const now = Date.now();
      if (now - amb.last < 100) return;
      // Full frame: edge colors are exactly what the bleed ring needs. The
      // hole punch below removes the middle, so letterbox bars in the source
      // only feed the ring, never the video.
      amb.ctx.globalCompositeOperation = 'source-over';
      amb.ctx.drawImage(v, 0, 0, AMB_W, AMB_H);
      ambPunch();
      // Stamp only after a successful draw: a failed frame must not consume
      // the next frame's budget or a frozen glow masks itself as working.
      amb.last = now;
      try { console.log('[Frostline Ambient] Tick drawn, video:', v.videoWidth+'x'+v.videoHeight, 'wrap:', amb.wrap.isConnected); } catch {}
    } catch {}
  }
  // Bleed margin on ALL sides so the halo reaches well past the player,
  // including the right screen edge. Sized against the blur: the ring holds
  // meaningful peak intensity only if the bleed is several times the blur.
  const AMB_BLEED = 400;
  // Backing store: large enough that the bleed ring is several pixels wide
  // before the blur, otherwise the halo peak fades to nothing.
  const AMB_W = 96, AMB_H = 54;
  // Player hole only: the overlay ring must never tint the video itself.
  // The sidebar is deliberately NOT punched: the wrapper already paints below
  // every positioned sibling, so the glow sits under the sidebar and shows
  // through its transparent areas instead of staining thumbnails and text.
  // The CSS blur softens the hole edges into a smooth falloff.
  function ambPunch() {
    try {
      const W = amb._pw || 0, H = amb._ph || 0;
      if (!amb.ctx || W <= 0 || H <= 0) return;
      const m = AMB_BLEED, fx = AMB_W / (W + m * 2), fy = AMB_H / (H + m * 2);
      amb.ctx.save();
      amb.ctx.globalCompositeOperation = 'destination-out';
      amb.ctx.fillRect(m * fx, m * fy, W * fx, H * fy);
      amb.ctx.restore();
    } catch {}
  }
  // ytd-app first: its opaque background buries a body-level overlay, and as
  // firstChild the glow paints above that background but below every
  // positioned sibling (player, sidebar, masthead). Falls back to body where
  // no app shell exists.
  function ambHost() {
    try { return document.querySelector('ytd-app') || document.body; } catch { return document.body; }
  }
  // Sync the overlay to the player's viewport rect. Cheap string
  // compare avoids layout thrash when nothing moved.
  function ambSyncRect() {
    try {
      const p = ambPlayer();
      if (!p || !amb.wrap) return;
      const r = p.getBoundingClientRect();
      if (!r.width || !r.height) { amb.wrap.style.display = 'none'; amb._rect = ''; amb._pw = 0; amb._ph = 0; return; }
      const key = Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + ',' + Math.round(r.height);
      if (amb._rect === key) { if (amb.wrap.style.display === 'none') amb.wrap.style.display = ''; return; }
      amb._rect = key;
      amb._pw = Math.round(r.width);
      amb._ph = Math.round(r.height);
      amb.wrap.style.display = '';
      amb.wrap.style.left = Math.round(r.left - AMB_BLEED) + 'px';
      amb.wrap.style.top = Math.round(r.top - AMB_BLEED) + 'px';
      amb.wrap.style.width = Math.round(r.width + AMB_BLEED * 2) + 'px';
      amb.wrap.style.height = Math.round(r.height + AMB_BLEED * 2) + 'px';
    } catch {}
  }
  function ambEnsure() {
    if (amb.dead) return;
    const p = ambPlayer();
    if (!p) return;
    const b = ambHost();
    if (!b) return;
    if (!amb.wrap || !amb.wrap.isConnected || amb.wrap.parentNode !== b) {
      ambTeardown();
      try {
        // The wrapper lives in ytd-app, NOT on body and NOT in the player.
        // Probed live: #movie_player, .html5-video-player and #ytd-player all
        // clip overflow (in-player bleed dies in normal mode), while a
        // body-level overlay is buried under ytd-app's opaque background.
        // As ytd-app's firstChild with no z-index, the glow paints above that
        // background but below every positioned sibling, so sidebar and player
        // render crisply on top.
        // The blur lives on the wrapper (not the canvas) so Shade's
        // !important brightness on `canvas` dims without killing the blur.
        const w = document.createElement('div');
        w.id = AMB_WRAP_ID;
        // Inline cssText, not a <style> element: the page CSP blocks styles a
        // content script injects, but inline styles on our own node survive it.
        w.style.cssText = 'position:fixed;pointer-events:none;filter:blur(' + AMB_BLUR * 1.6 + 'px)';
        const c = document.createElement('canvas');
        c.id = AMB_ID;
        c.width = AMB_W;
        c.height = AMB_H;
        // No filter, no blend, no scale on the canvas: plain alpha compositing
        // shows on any page background, and the wrapper blur supplies the
        // softness. Scale was dropped because it would misalign the holes.
        c.style.cssText = 'width:100%;height:100%;display:block;opacity:0.75';
        w.appendChild(c);
        amb.wrap = w;
        amb.canvas = c;
        amb._rect = '';
        b.insertBefore(w, b.firstChild);
        ambSyncRect();
        try { console.log('[Frostline Ambient] Created body-level wrap, player rect:', p.getBoundingClientRect().toJSON()); } catch {}
      } catch { ambTeardown(); return; }
      try { amb.ctx = amb.canvas.getContext('2d'); } catch { amb.ctx = null; }
      // Fallback: a dark neutral so slow loads show almost nothing instead of
      // washing the whole page in the old bright-blue placeholder.
      if (amb.ctx) {
        amb.ctx.globalCompositeOperation = 'source-over';
        amb.ctx.fillStyle = '#0d1526';
        amb.ctx.fillRect(0, 0, AMB_W, AMB_H);
        ambPunch();
        try { console.log('[Frostline Ambient] Fallback painted'); } catch {}
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
    // The glow touches no page nodes (body-level overlay only), so teardown
    // is just removing the wrapper.
    amb.wrap = null;
    amb.canvas = null;
    amb.ctx = null;
    amb.last = 0;
    amb._rect = '';
    // Remove the wrapper: that takes the canvas with it, so teardown never
    // leaves a detached canvas behind or has to track two nodes.
    if (w) { try { w.remove(); } catch {} }
  }
  function ambApply() {
    try {
      // Preview players on browse pages must stay untouched, same rule as
      // theater.js applyAll: gate here so enables elsewhere cannot paint.
      if (!isWatchPage()) { ambTeardown(); return; }
      try { console.log('[Frostline Ambient] ambApply called, cfg.ambient:', cfg.ambient, 'nativeFs:', nativeFs(), 'isWatchPage:', isWatchPage()); } catch {}
      if (cfg.ambient && !nativeFs()) {
        ambEnsure();
        // The watchdog outlives individual canvases so a page the SPA swapped
        // out and back still gets the backdrop re-attached with no user action.
        if (!amb.dead && !amb.watch) {
          amb.watch = setInterval(ambWatch, 500);
          try { console.log('[Frostline Ambient] Watchdog started'); } catch {}
        }
      } else ambTeardown();
    } catch {}
  }
  try {
    document.addEventListener('fullscreenchange', ambApply);
    document.addEventListener('webkitfullscreenchange', ambApply);
  } catch {}
  // The tick only re-syncs up to 10 times a second, so fast page or sidebar
  // scrolls leave the fixed overlay lagging behind as a visible stripe. Sync
  // on scroll/resize immediately, rAF-throttled, capture phase to catch
  // nested scrollers like the watch sidebar.
  let ambSyncQueued = false;
  function ambSyncSoon() {
    if (ambSyncQueued || !amb.wrap) return;
    ambSyncQueued = true;
    try {
      requestAnimationFrame(() => {
        ambSyncQueued = false;
        try { ambSyncRect(); } catch {}
      });
    } catch { ambSyncQueued = false; }
  }
  try {
    document.addEventListener('scroll', ambSyncSoon, { passive: true, capture: true });
    window.addEventListener('resize', ambSyncSoon);
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
  // destination and louder comes out as distortion instead of volume. The
  // ceiling sits at full scale with a gentler ratio: a low threshold pinned
  // everything on already-loud videos to the same ceiling, which made the
  // boost control feel dead. Peaks still cannot clip past 0dBFS.
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
      audio.limiter.threshold.value = 0;
      audio.limiter.knee.value = 0;
      audio.limiter.ratio.value = 12;
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
