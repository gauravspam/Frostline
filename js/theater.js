// Frostline Theater content script (YouTube watch pages): Windowed fullscreen.
// Runs on every YT load automatically (manifest content_scripts). Layout CSS
// comes from the worker via insertCSS (page CSP blocks inline <style>).
(function () {
  if (window.__frostlineThCS) return;
  window.__frostlineThCS = 1;
  // wfs defaults to 0: windowed mode is opt-in per session, otherwise every
  // video opened from the homepage enters it before the user can react.
  const DEF = { enabled: 0, wfs: 0, remember: 1, shortcut: 1 };
  let cfg = Object.assign({}, DEF);
  const store = (cb) => {
    try {
      chrome.storage.local.get(['frostline_ytCfg', 'frostline_theaterMem'], (o) => {
        try {
          const c = Object.assign({}, DEF, ((o && o.frostline_ytCfg) || {}));
          const vid = vidOf();
          const mem = (o && o.frostline_theaterMem) || {};
          if (c.remember && vid && mem[vid]) {
            c.wfs = mem[vid].wfs ? 1 : 0;
          }
          cfg = c;
        } catch {}
        if (cb) cb();
      });
    } catch { if (cb) cb(); }
  };
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
  function vidOf() {
    try {
      const u = new URL(location.href);
      if (u.hostname.indexOf('youtube.com') >= 0) {
        if (u.pathname === '/watch') return u.searchParams.get('v') || '';
        if (u.pathname.indexOf('/shorts/') === 0) return u.pathname.split('/')[2] || '';
      }
      if (u.hostname === 'youtu.be') return u.pathname.replace(/^\//, '').split('/')[0] || '';
    } catch {}
    return '';
  }
  function save(patch) {
    const vid = vidOf();
    const refresh = () => { try { chrome.runtime.sendMessage({ cmd: 'theater-apply' }, () => { void chrome.runtime.lastError; }); } catch {} };
    try {
      chrome.storage.local.get('frostline_ytCfg', (o) => {
        try {
          const cur = (o && o.frostline_ytCfg) || {};
          const c = {
            enabled: 1,
            wfs: cur.wfs ? 1 : 0,
            remember: (cur.remember === 0 ? 0 : 1),
            shortcut: (cur.shortcut === 0 ? 0 : 1)
          };
          Object.keys(patch || {}).forEach((k) => { c[k] = patch[k]; });
          chrome.storage.local.set({ frostline_ytCfg: c }, () => {
            cfg = Object.assign({}, cfg, c);
            if (vid && c.remember) {
              chrome.storage.local.get('frostline_theaterMem', (m) => {
                try {
                  const mem = ((m && m.frostline_theaterMem) || {});
                  mem[vid] = { wfs: c.wfs ? 1 : 0 };
                  chrome.storage.local.set({ frostline_theaterMem: mem }, refresh);
                } catch { refresh(); }
              });
            } else refresh();
          });
        } catch { refresh(); }
      });
    } catch {}
  }
  function theaterOn() {
    // Windowed geometry comes from our fixed player rules alone. Clicking
    // YouTube's own theater toggle re-lays-out its player behind our back and
    // is not needed for the windowed frame.
  }
  function theaterOff() {
    try {
      const fx = document.querySelector('ytd-watch-flexy');
      const on = document.querySelector('ytd-watch-flexy[theater]') || (fx && fx.hasAttribute('theater'));
      if (!on) return;
      const cands = [document.querySelector('.ytp-size-button'), document.querySelector('button.ytp-size-button')].filter(Boolean);
      for (let i = 0; i < cands.length; i++) { try { cands[i].click(); } catch {} }
      if (fx && fx.hasAttribute('theater')) { try { fx.removeAttribute('theater'); } catch {} }
    } catch {}
  }
  // YouTube's own fullscreen and our windowed mode both size and position the
  // player. Applying both at once left the controls unpainted and the frame
  // displaced, so windowed mode stands down while native fullscreen owns the
  // element, and resumes when the user leaves it.
  function nativeFs() {
    try { return !!(document.fullscreenElement || document.webkitFullscreenElement); } catch { return false; }
  }
  function applyAll() {
    if (!isWatchPage()) { cleanup(); return; }
    const de = document.documentElement;
    const wfsOn = !!(cfg.enabled && cfg.wfs && !nativeFs());
    if (wfsOn) theaterOn(); else theaterOff();
    de.classList.toggle('frostline-th-wfs', wfsOn);
    de.classList.toggle('frostline-th', !!cfg.enabled);
    try { window.dispatchEvent(new Event('resize')); } catch {}
  }
  function onNativeFs() {
    try { tipHide(); } catch {}
    try { applyAll(); } catch {}
  }
  function onKey(e) {
    try {
      if (!cfg.enabled) return;
      const active = !!cfg.wfs;
      if (e.key === 'Escape' && active) {
        e.preventDefault();
        cfg.wfs = 0;
        applyAll(); paintB();
        save({ wfs: 0 });
        return;
      }
      const tag = ((e.target && e.target.tagName) || '').toUpperCase();
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || !!(e.target && e.target.isContentEditable);
      if (typing) return;
      const backtick = e.key === String.fromCharCode(96) || e.key === '´' || e.key === '~' || e.code === 'Backquote';
      if (backtick && cfg.shortcut) {
        e.preventDefault();
        e.stopPropagation();
        cfg.wfs = cfg.wfs ? 0 : 1;
        applyAll(); paintB();
        save({ wfs: cfg.wfs });
      }
    } catch {}
  }
  try { document.addEventListener('keydown', onKey, true); } catch {}
  // Hover pill for the injected button. YouTube paints .ytp-tooltip only when it
  // carries ytp-frosted-glass-fade-transition, which its own manager adds to the
  // buttons present at player build time. Ours is injected later, so without this
  // the title renders as the browser's own black box under the bar. Reusing
  // YouTube's classes and its position math (above the button, centred on it)
  // makes it indistinguishable from the Settings and CC pills.
  const TIP_ID = 'frostline-th-tip';
  function tipHide() {
    try { const t = document.getElementById(TIP_ID); if (t) t.remove(); } catch {}
  }
  // Native pills parent to .html5-video-player (not #movie_player), which sets
  // the 11px type base, and float centred on the button with a 22px gap above
  // it. Both measured live and constant across player sizes, so replicate both.
  function tipShow(btn) {
    try {
      tipHide();
      if (!btn || !btn.isConnected) return;
      const host = (btn.closest && btn.closest('.html5-video-player')) || document.getElementById('movie_player');
      if (!host) return;
      if (getComputedStyle(host).position === 'static') host.style.setProperty('position', 'relative', 'important');
      const tip = document.createElement('div');
      tip.id = TIP_ID;
      tip.className = 'ytp-tooltip ytp-bottom';
      const wrap = document.createElement('div');
      wrap.className = 'ytp-tooltip-text-wrapper ytp-frosted-glass-fade-transition';
      const row = document.createElement('div');
      row.className = 'ytp-tooltip-bottom-text';
      // YouTube renders the label as an inline span and the shortcut badge as a
      // display:flex div, so in a narrow container (fullscreen) the badge falls
      // onto its own line. Pin the row to one line instead.
      row.style.cssText = 'display:flex;align-items:center;white-space:nowrap;width:max-content';
      const label = document.createElement('span');
      label.className = 'ytp-tooltip-text';
      label.textContent = 'Windowed fullscreen';
      const key = document.createElement('div');
      key.className = 'ytp-tooltip-keyboard-shortcut';
      key.textContent = '`';
      row.appendChild(label); row.appendChild(key);
      wrap.appendChild(row);
      tip.appendChild(wrap);
      tip.setAttribute('aria-hidden', 'false');
      // The pill is absolutely positioned, so it shrink-wraps to the container
      // and can wrap early. max-content keeps it as wide as its content.
      tip.style.cssText = 'max-width:none;width:max-content';
      host.appendChild(tip);
      const br = btn.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      tip.style.left = (br.x - hr.x + Math.round((br.width - tip.offsetWidth) / 2)) + 'px';
      tip.style.top = (br.y - hr.y - tip.offsetHeight - 22) + 'px';
      tip.style.opacity = '1';
    } catch {}
  }
  function paintB() {
    const bw = document.getElementById('frostline-th-wfs');
    if (bw) bw.setAttribute('aria-checked', cfg.wfs ? 'true' : 'false');
  }
  function findBar() {
    const sel = (s) => { try { const n = document.querySelector(s); return (n && n.isConnected) ? n : null; } catch { return null; } };
    const gear = sel('#movie_player .ytp-settings-button') || sel('.ytp-settings-button');
    if (gear) {
      let p = gear.parentNode;
      while (p && p.nodeType === 1) {
        if (p.classList && (p.classList.contains('ytp-right-controls') || p.classList.contains('ytp-chrome-controls'))) return { bar: p, why: 'bar-gear' };
        if (p.id === 'movie_player') break;
        p = p.parentNode;
      }
      if (gear.parentNode) return { bar: gear.parentNode, why: 'gear-parent' };
    }
    let b = sel('#movie_player .ytp-right-controls') || sel('.ytp-right-controls')
      || sel('.ytp-chrome-controls .ytp-right-controls') || sel('.html5-video-player .ytp-right-controls');
    if (b) return { bar: b, why: 'right-controls' };
    b = sel('.ytp-chrome-controls');
    if (b) return { bar: b, why: '.ytp-chrome-controls' };
    b = sel('#movie_player');
    if (b) return { bar: b, why: '#movie_player' };
    return { bar: null, why: 'none' };
  }
  function inject() {
    try {
      const ex = document.getElementById('frostline-th-wfs');
      if (ex && ex.isConnected && ex.dataset.frostlineBv === '16') { paintB(); return true; }
      if (ex) { try { ex.remove(); } catch {} }
      const old = document.getElementById('frostline-th-str');
      if (old) { try { old.remove(); } catch {} }
      const r = findBar();
      const bar = r.bar;
      if (!bar) return false;
      const mk = (id, title, svg) => {
        // No title attribute: the browser would render its own black box under
        // the bar, and YouTube's tooltip manager would render a second pill for
        // the same string. tipShow() paints the single pill instead, using
        // YouTube's own classes. The accessible name stays on aria-label.
        const b = document.createElement('button');
        b.className = 'ytp-button frostline-th-btn';
        b.id = id;
        b.dataset.frostlineBv = '16';
        b.setAttribute('aria-label', title);
        b.setAttribute('role', 'switch');
        b.setAttribute('aria-checked', 'false');
        b.innerHTML = svg;
        return b;
      };
      const svgW = '<svg height="24" viewBox="0 0 24 24" width="24"><path d="M3 3h6v2H5v4H3V3zm18 0h-6v2h4v4h2V3zM3 21h6v-2H5v-4H3v6zm18 0h-6v-2h4v-4h2v6z" fill="white"/></svg>';
      const bw = mk('frostline-th-wfs', 'Windowed fullscreen (`)', svgW);
      // Fullscreen and windowed are mutually exclusive selections: clicking our
      // button inside native fullscreen leaves fullscreen first and turns
      // windowed on, instead of toggling blindly (which visibly did nothing).
      // Toggling freely only applies outside fullscreen.
      bw.onclick = (e) => {
        tipHide();
        e.preventDefault();
        e.stopPropagation();
        let inFs = false;
        try { inFs = !!(document.fullscreenElement || document.webkitFullscreenElement); } catch {}
        if (inFs) {
          try { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch {}
          cfg.wfs = 1;
        } else {
          cfg.wfs = cfg.wfs ? 0 : 1;
        }
        applyAll(); paintB();
        save({ wfs: cfg.wfs });
      };
      try {
        bw.addEventListener('mouseenter', () => tipShow(bw));
        bw.addEventListener('mouseleave', tipHide);
      } catch {}
      const anchor = bar.querySelector('.ytp-settings-button');
      const host = anchor ? anchor.parentNode : bar;
      if (anchor) { host.insertBefore(bw, anchor); }
      else { bar.insertBefore(bw, bar.firstChild); }
      paintB();
      return true;
    } catch { return false; }
  }
  function waitPlayer(cb, n) {
    try {
      if (document.querySelector('#movie_player')) { cb(); return; }
      if ((n || 0) > 100) { cb(); return; }
      setTimeout(() => waitPlayer(cb, (n || 0) + 1), 100);
    } catch { try { cb(); } catch {} }
  }
  function ensureButtons() {
    watchPlayer();
    if (inject()) return;
    if (window.__frostlineThBtnIv) return;
    waitPlayer(() => { try { inject(); } catch {} });
    try {
      window.__frostlineThBtnIv = setInterval(() => {
        if (inject()) { try { clearInterval(window.__frostlineThBtnIv); } catch {} window.__frostlineThBtnIv = 0; }
      }, 1000);
    } catch {}
  }
  // YouTube rebuilds player controls on theater/quality changes, destroying
  // injected buttons. Watch persistently and re-inject (throttled).
  function watchPlayer() {
    if (window.__frostlineThObs) return;
    try {
      let last = 0;
      const ob = new MutationObserver(() => {
        if (!cfg.enabled) return;
        const cur = document.getElementById('frostline-th-wfs');
        // Also re-inject when the button survives but a stale-stamp node is
        // present, so a markup change self-heals in already-open tabs.
        if (cur && cur.isConnected && cur.dataset.frostlineBv === '16') return;
        const now = Date.now();
        if (now - last < 400) return;
        last = now;
        inject();
      });
      window.__frostlineThObs = ob;
      ob.observe(document.body, { childList: true, subtree: true });
    } catch {}
  }
  function cleanup() {
    tipHide();
    try { document.documentElement.classList.remove('frostline-th-wfs', 'frostline-th'); } catch {}
    try { const a = document.getElementById('frostline-th-wfs'); if (a) a.remove(); } catch {}
    try { const s = document.getElementById('frostline-th-str'); if (s) s.remove(); } catch {}
    const v = document.querySelector('video');
    if (v) { v.style.transform = ''; try { v.style.objectFit = ''; } catch {} }
  }
  function maybeHint() {
    try {
      chrome.storage.local.get('frostline_thHint', (o) => {
        try {
          if (o && o.frostline_thHint) return;
          if (!cfg.enabled || !cfg.shortcut) return;
          try { chrome.storage.local.set({ frostline_thHint: 1 }); } catch {}
          const t = document.createElement('div');
          t.className = 'frostline-th-hint';
          t.textContent = 'Press ` to toggle Theater · Esc to exit';
          t.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:2147483647;background:rgba(15,18,24,.94);color:#fff;font:600 13px/1.4 system-ui,sans-serif;letter-spacing:.01em;padding:10px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 30px rgba(0,0,0,.45);pointer-events:none;opacity:0;transition:opacity .35s ease;';
          (document.body || document.documentElement).appendChild(t);
          requestAnimationFrame(() => { try { t.style.opacity = '1'; } catch {} });
          setTimeout(() => { try { t.style.opacity = '0'; } catch {} setTimeout(() => { try { t.remove(); } catch {} }, 400); }, 5000);
        } catch {}
      });
    } catch {}
  }
  function boot() {
    try { document.documentElement.dataset.frostlineTh = '1.4.45'; } catch {}
    store(() => {
      if (!cfg.enabled) { cleanup(); return; }
      try { applyAll(); } catch {}
      ensureButtons();
      maybeHint();
      try { chrome.runtime.sendMessage({ cmd: 'theater-apply' }, () => { void chrome.runtime.lastError; }); } catch {}
    });
  }
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch.frostline_ytCfg && ch.frostline_ytCfg.newValue) {
        cfg = Object.assign({}, cfg, ch.frostline_ytCfg.newValue);
        if (cfg.enabled) { applyAll(); ensureButtons(); }
        else cleanup();
      }
    });
  } catch {}
  try { document.addEventListener('yt-navigate-finish', () => { if (cfg.enabled && isWatchPage()) { applyAll(); ensureButtons(); } else cleanup(); }); } catch {}
  try { document.addEventListener('fullscreenchange', onNativeFs); } catch {}
  try { document.addEventListener('webkitfullscreenchange', onNativeFs); } catch {}
  let lastUrl = '';
  try { lastUrl = location.href; } catch {}
  setInterval(() => {
    try {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (cfg.enabled) { store(() => { if (cfg.enabled && isWatchPage()) { applyAll(); ensureButtons(); } else cleanup(); }); }
        else cleanup();
      }
    } catch {}
  }, 1500);
  boot();
})();
