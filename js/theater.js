// Frostline Theater content script (YouTube watch pages): Windowed fullscreen.
// Runs on every YT load automatically (manifest content_scripts). Layout CSS
// comes from the worker via insertCSS (page CSP blocks inline <style>).
(function () {
  if (window.__auroraThCS) return;
  window.__auroraThCS = 1;
  const DEF = { enabled: 0, wfs: 1, remember: 1, shortcut: 1 };
  let cfg = Object.assign({}, DEF);
  const store = (cb) => {
    try {
      chrome.storage.local.get(['aurora_ytCfg', 'aurora_theaterMem'], (o) => {
        try {
          const c = Object.assign({}, DEF, ((o && o.aurora_ytCfg) || {}));
          const vid = vidOf();
          const mem = (o && o.aurora_theaterMem) || {};
          if (c.remember && vid && mem[vid]) {
            c.wfs = mem[vid].wfs ? 1 : 0;
          }
          cfg = c;
        } catch {}
        if (cb) cb();
      });
    } catch { if (cb) cb(); }
  };
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
      chrome.storage.local.get('aurora_ytCfg', (o) => {
        try {
          const cur = (o && o.aurora_ytCfg) || {};
          const c = {
            enabled: 1,
            wfs: cur.wfs ? 1 : 0,
            remember: (cur.remember === 0 ? 0 : 1),
            shortcut: (cur.shortcut === 0 ? 0 : 1)
          };
          Object.keys(patch || {}).forEach((k) => { c[k] = patch[k]; });
          chrome.storage.local.set({ aurora_ytCfg: c }, () => {
            cfg = Object.assign({}, cfg, c);
            if (vid && c.remember) {
              chrome.storage.local.get('aurora_theaterMem', (m) => {
                try {
                  const mem = ((m && m.aurora_theaterMem) || {});
                  mem[vid] = { wfs: c.wfs ? 1 : 0 };
                  chrome.storage.local.set({ aurora_theaterMem: mem }, refresh);
                } catch { refresh(); }
              });
            } else refresh();
          });
        } catch { refresh(); }
      });
    } catch {}
  }
  function theaterOn() {
    try {
      const tb = document.querySelector('.ytp-size-button');
      const on = document.querySelector('ytd-watch-flexy[theater]');
      if (tb && !on && tb.click) tb.click();
    } catch {}
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
  function applyAll() {
    const de = document.documentElement;
    const wfsOn = !!(cfg.enabled && cfg.wfs);
    if (wfsOn) theaterOn(); else theaterOff();
    de.classList.toggle('frostline-th-wfs', wfsOn);
    de.classList.toggle('frostline-th', !!cfg.enabled);
    try { window.dispatchEvent(new Event('resize')); } catch {}
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
  let tipRaf = 0;
  function tipHide() {
    try { if (tipRaf) { cancelAnimationFrame(tipRaf); tipRaf = 0; } } catch {}
    try { const t = document.getElementById('frostline-th-tip'); if (t) t.remove(); } catch {}
  }
  // YouTube slides/translates .ytp-chrome-bottom while the chrome fades in, and
  // re-lays-out the bar when it gains or loses buttons. Placing the pill once on
  // mouseenter lets it drift off the button, which reads as a horizontal
  // misalignment. Track the anchor every frame while the pill is visible.
  function tipTrack(tip, anchor, host) {
    let last = '';
    const step = () => {
      tipRaf = 0;
      try {
        if (!tip.isConnected || !anchor.isConnected) { tipHide(); return; }
        const ar = anchor.getBoundingClientRect();
        const hr = host.getBoundingClientRect();
        const key = Math.round(ar.left) + ':' + Math.round(ar.top);
        if (key !== last) {
          last = key;
          tip.style.left = (ar.left + ar.width / 2 - hr.left) + 'px';
          tip.style.top = (ar.top - hr.top) + 'px';
        }
      } catch { tipHide(); return; }
      tipRaf = requestAnimationFrame(step);
    };
    tipRaf = requestAnimationFrame(step);
  }
  function tipShow(anchor) {
    try {
      tipHide();
      if (!anchor || !anchor.isConnected) return;
      try { anchor.style.setProperty('position', 'relative', 'important'); } catch {}
      try { anchor.style.setProperty('overflow', 'visible', 'important'); } catch {}
      const tip = document.createElement('div');
      tip.id = 'frostline-th-tip';
      tip.className = 'ytp-tooltip ytp-bottom';
      tip.setAttribute('aria-hidden', 'false');
      tip.setAttribute('aria-live', 'polite');
      const wrap = document.createElement('div');
      wrap.className = 'ytp-tooltip-text-wrapper ytp-frosted-glass-fade-transition';
      const row = document.createElement('div');
      row.className = 'ytp-tooltip-bottom-text';
      const lb = document.createElement('span');
      lb.className = 'ytp-tooltip-text';
      lb.textContent = 'Windowed fullscreen';
      const kb = document.createElement('div');
      kb.className = 'ytp-tooltip-keyboard-shortcut';
      kb.textContent = '`';
      row.appendChild(lb); row.appendChild(kb);
      wrap.appendChild(row);
      tip.appendChild(wrap);
      // NB: the pill must NOT be appended to the controls bar. The bar is only
      // ~170px wide, and an absolutely-positioned shrink-to-fit box is capped by
      // its containing block, so "Windowed fullscreen" wraps to two lines and the
      // pill renders as a tall dark rectangle. Native YouTube parents its
      // tooltips to #movie_player instead; do the same and position from rects.
      tip.style.cssText = 'position:absolute;pointer-events:none;display:block;white-space:nowrap;width:max-content;';
      let host = document.getElementById('movie_player');
      if (!host) { let p = anchor.parentNode; while (p && p.id !== 'movie_player') p = p.parentNode; host = (p && p.id === 'movie_player') ? p : null; }
      if (!host) { anchor.prepend(tip); return; }
      try { host.style.setProperty('position', 'relative', 'important'); } catch {}
      host.appendChild(tip);
      const ar = anchor.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      tip.style.left = (ar.left + ar.width / 2 - hr.left) + 'px';
      tip.style.top = (ar.top - hr.top) + 'px';
      tip.style.marginTop = '-12px';
      tip.style.transform = 'translateX(-50%) translateY(-100%)';
      tipTrack(tip, anchor, host);
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
      if (ex && ex.isConnected && ex.dataset.auroraBv === '6') { paintB(); return true; }
      if (ex) { try { ex.remove(); } catch {} }
      const old = document.getElementById('frostline-th-str');
      if (old) { try { old.remove(); } catch {} }
      const r = findBar();
      const bar = r.bar;
      if (!bar) return false;
      const mk = (id, title, svg) => {
        const b = document.createElement('button');
        b.className = 'ytp-button frostline-th-btn';
        b.id = id;
        b.dataset.auroraBv = '6';
        b.title = title;
        b.setAttribute('aria-label', title);
        b.setAttribute('role', 'switch');
        b.setAttribute('aria-checked', 'false');
        b.innerHTML = svg;
        return b;
      };
      const svgW = '<svg height="24" viewBox="0 0 24 24" width="24"><path d="M3 3h6v2H5v4H3V3zm18 0h-6v2h4v4h2V3zM3 21h6v-2H5v-4H3v6zm18 0h-6v-2h4v-4h2v6z" fill="white"/></svg>';
      const bw = mk('frostline-th-wfs', 'Windowed fullscreen (`)', svgW);
      bw.onclick = (e) => {
        tipHide();
        e.preventDefault();
        e.stopPropagation();
        cfg.wfs = cfg.wfs ? 0 : 1;
        applyAll(); paintB();
        save({ wfs: cfg.wfs });
      };
      try { bw.addEventListener('mouseenter', () => tipShow(bw)); bw.addEventListener('mouseleave', tipHide); } catch {}
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
    if (window.__auroraThBtnIv) return;
    waitPlayer(() => { try { inject(); } catch {} });
    try {
      window.__auroraThBtnIv = setInterval(() => {
        if (inject()) { try { clearInterval(window.__auroraThBtnIv); } catch {} window.__auroraThBtnIv = 0; }
      }, 1000);
    } catch {}
  }
  // YouTube rebuilds player controls on theater/quality changes, destroying
  // injected buttons. Watch persistently and re-inject (throttled), Suite-style.
  function watchPlayer() {
    if (window.__auroraThObs) return;
    try {
      let last = 0;
      const ob = new MutationObserver(() => {
        if (!cfg.enabled) return;
        const cur = document.getElementById('frostline-th-wfs');
        if (cur && cur.isConnected) return;
        const now = Date.now();
        if (now - last < 800) return;
        last = now;
        inject();
      });
      window.__auroraThObs = ob;
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
      chrome.storage.local.get('aurora_thHint', (o) => {
        try {
          if (o && o.aurora_thHint) return;
          if (!cfg.enabled || !cfg.shortcut) return;
          try { chrome.storage.local.set({ aurora_thHint: 1 }); } catch {}
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
    try { document.documentElement.dataset.auroraTh = '1.4.35'; } catch {}
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
      if (area === 'local' && ch.aurora_ytCfg && ch.aurora_ytCfg.newValue) {
        cfg = Object.assign({}, cfg, ch.aurora_ytCfg.newValue);
        if (cfg.enabled) { applyAll(); ensureButtons(); }
        else cleanup();
      }
    });
  } catch {}
  try { document.addEventListener('yt-navigate-finish', () => { if (cfg.enabled) { applyAll(); ensureButtons(); } }); } catch {}
  let lastUrl = '';
  try { lastUrl = location.href; } catch {}
  setInterval(() => {
    try {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (cfg.enabled) { store(() => { if (cfg.enabled) { applyAll(); ensureButtons(); } else cleanup(); }); }
      }
    } catch {}
  }, 1500);
  boot();
})();
