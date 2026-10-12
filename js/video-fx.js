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
  const audio = { ctx: null, limiter: null, gains: new WeakMap(), gestured: false, dead: false };
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
  // No behavior yet; the storage path is settled here so feature code only replaces these bodies.
  function ambApply() {}
  function volApply() {}
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
})();
