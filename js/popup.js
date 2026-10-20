// Frostline toolbar popup: quick Shade + Theater control (same storage as the newtab page)
const store = {
  get: (k, d) => { try { const v = localStorage.getItem('frostline_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('frostline_' + k, JSON.stringify(v)); } catch {} },
};
// Disclosure state for the collapsible rows. These are view preferences rather
// than feature state, so they live in their own store and never reach the
// shared configs the worker and the content script also write.
const UI_DEF = { shade: 1, vol: 1, ov: 1 };
let ui = Object.assign({}, UI_DEF, store.get('popupUI', {}));
function saveUi() { store.set('popupUI', ui); try { chrome.storage.local.set({ frostline_popupUI: ui }); } catch {} }
let dim = Object.assign({ enabled: 0, intensity: 40, white: 1, dark: 0, fx: { dimmer: 1 }, vals: { dimmer: 0, reader: 0, blur: 0 }, edit: 'dimmer', mode: 'dimmer', scope: 'page' }, store.get('dimmerCfg', {}));
function dimEnsureShapeP(){
  dim.fx = dim.fx || {};
  // Fill in MISSING values only; a stored 0 is a deliberate choice and is kept.
  const DEF = { dimmer: 0, reader: 0, blur: 0 };
  dim.vals = Object.assign({}, DEF, dim.vals || {});
  for (const k of ['dimmer', 'reader', 'blur']) {
    const v = dim.vals[k];
    if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 100) dim.vals[k] = DEF[k];
  }
  if (!['dimmer', 'reader', 'blur'].includes(dim.edit)) dim.edit = 'dimmer';
  dim.mode = dim.edit;
  if (dim.fx.dimmer === undefined) dim.fx.dimmer = 1;
  if (dim.fx.reader === undefined) dim.fx.reader = 1;
  if (dim.fx.blur === undefined) dim.fx.blur = 1;
  dim.scopes = Object.assign({ dimmer: 'page', reader: 'page', blur: 'page' }, dim.scopes || {});
}
(function(){try{if(!localStorage.getItem('frostline_fxMigrated')){const d=store.get('dimmerCfg',null);if(d&&!d.fx){const fx={dimmer:0,reader:0,blur:0};if(d.warm)fx.reader=1;if(d.blur)fx.blur=1;if(d.mode==='reader')fx.reader=1;else if(d.mode==='blur')fx.blur=1;if(!fx.reader&&!fx.blur)fx.dimmer=1;d.fx=fx;store.set('dimmerCfg',d);dim.fx=fx;}localStorage.setItem('frostline_fxMigrated','1');}}catch{}})();
(function(){try{if(!localStorage.getItem('frostline_dimMigrated')){const d=store.get('dimmerCfg',null);if(d&&typeof d.intensity==='number'){d.intensity=Math.min(100,Math.max(0,100-d.intensity));store.set('dimmerCfg',d);dim.intensity=d.intensity;}localStorage.setItem('frostline_dimMigrated','1');}}catch{}})();
// The worker reads Shade from chrome.storage.local; the popup read only
// localStorage, so the two could disagree and the popup could show Shade off
// while the engine kept painting a stale blur into every tab. Adopt the worker's
// copy as the starting state and mirror it back to localStorage.
function adoptDim(next) {
  if (!next || typeof next !== 'object') return;
  dim = Object.assign(dim, next);
  dimEnsureShapeP();
  store.set('dimmerCfg', dim);
}
try {
  chrome.storage.local.get('frostline_dimmerCfg', o => { try { adoptDim(o && o.frostline_dimmerCfg); } catch {} paint(); });
} catch {}
let pushT = null;
function saveDim() {
  store.set('dimmerCfg', dim);
  try { chrome.storage.local.set({ frostline_dimmerCfg: dim }); } catch {}
  clearTimeout(pushT);
  pushT = setTimeout(() => { try { chrome.runtime.sendMessage({ cmd: 'dim-apply' }, () => { void chrome.runtime.lastError; }); } catch {} }, 150);
}
function paint() {
  const t = document.querySelector('#pp-toggle');
  if (t) t.classList.toggle('on', !!dim.enabled);
  // Shade sub-controls only exist while Shade is on, mirroring the Volume
  // Boost slider pattern: no toggle, no controls. The caret is a second,
  // independent gate, so the block can also be folded away while Shade is on.
  const shadeOpen = dim.enabled && !!ui.shade;
  const dr = document.querySelector('#pp-dim-row');
  if (dr) dr.style.display = shadeOpen ? '' : 'none';
  const md = document.querySelector('#pp-mode');
  if (md) md.style.display = shadeOpen ? '' : 'none';
  const sc = document.querySelector('#pp-scope');
  if (sc) sc.style.display = shadeOpen ? '' : 'none';
  const dc = document.querySelector('#pp-shade-caret');
  if (dc) { dc.classList.toggle('open', !!ui.shade); dc.setAttribute('aria-expanded', ui.shade ? 'true' : 'false'); dc.disabled = !dim.enabled; }
  const r = document.querySelector('#pp-intensity');
  dimEnsureShapeP();
  if (r && document.activeElement !== r) {
    r.value = dim.vals[dim.edit];
    // Blue fill gradient matching the thumb position
    r.style.background = 'linear-gradient(#0a84ff,#0a84ff) 0 50%/' + dim.vals[dim.edit] + '% 4px no-repeat,rgba(120,120,128,.3) 0 50%/100% 4px no-repeat';
  }
  const v = document.querySelector('#pp-val');
  const isPreview = dim.edit !== dim.mode;
  if (v) v.textContent = dim.vals[dim.edit] + '% - ' + (dim.edit === 'dimmer' ? 'dim' : dim.edit) + (isPreview ? ' (preview)' : '');
  v && v.classList.toggle('preview', isPreview);
  document.querySelectorAll('#pp-mode button').forEach(b => { const sel = dim.edit === b.dataset.m; b.classList.toggle('on', sel); b.classList.toggle('edit', sel); });
  // Media scope is not effective for Reader (no sepia on media); disable that button.
  const readerMedia = dim.edit === 'reader';
  document.querySelectorAll('#pp-scope button').forEach(b => {
    const on = b.dataset.s === ((dim.scopes || {})[dim.edit || 'dimmer'] || 'page');
    b.classList.toggle('on', on);
    b.disabled = readerMedia && b.dataset.s === 'media';
  });
}
document.querySelector('#pp-toggle').onclick = () => { dim.enabled = dim.enabled ? 0 : 1; saveDim(); paint(); };
document.querySelector('#pp-intensity').oninput = e => {
  dimEnsureShapeP();
  dim.vals[dim.edit] = +e.target.value;
  dim.mode = dim.edit;
  // 0 is a valid "off" value; anything above 0 arms the effect.
  dim.fx[dim.edit] = (+e.target.value > 0) ? 1 : 0;
  const pct = e.target.value;
  e.target.style.background = 'linear-gradient(#0a84ff,#0a84ff) 0 50%/' + pct + '% 4px no-repeat,rgba(120,120,128,.3) 0 50%/100% 4px no-repeat';
  saveDim();
  paint();
};
// Modes are exclusive, so selecting one must also make it the active mode and
// carry over the currently shown scope. Otherwise dimCss keeps painting the
// previous effect, which is why Reader showed a black screen and why the
// scope buttons appeared to apply to the wrong mode.
// Reader on Media is not meaningful (no sepia/saturate on media elements),
// so force scope to 'page' when Reader is selected.
document.querySelectorAll('#pp-mode button').forEach(b => b.onclick = () => {
  const k = b.dataset.m;
  dimEnsureShapeP();
  const cur = dim.scopes[dim.edit] || 'page';
  dim.edit = k;
  dim.mode = k;
  // Reader on Media is not meaningful - force page scope
  dim.scopes[k] = (k === 'reader') ? 'page' : cur;
  // Arming is driven by the value, not by the click. A mode whose value is 0 is a
  // deliberate off state, so clicking it must not switch the effect back on.
  dim.fx[k] = (+dim.vals[k] > 0) ? 1 : 0;
  saveDim();
  paint();
});
// Scope applies to the active mode only. Media is not valid for Reader
// (sepia/saturate have no effect on media elements).
document.querySelectorAll('#pp-scope button').forEach(b => b.onclick = () => {
  dimEnsureShapeP();
  // Prevent Reader + Media combination
  if (dim.edit === 'reader' && b.dataset.s === 'media') return;
  dim.scopes[dim.edit || 'dimmer'] = b.dataset.s;
  saveDim();
  paint();
});

try {
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.frostline_dimmerCfg && ch.frostline_dimmerCfg.newValue) {
      dim = Object.assign(dim, ch.frostline_dimmerCfg.newValue);
      paint();
    }
    if (area === 'local' && ch.frostline_ytCfg && ch.frostline_ytCfg.newValue) {
      th = Object.assign(th, ch.frostline_ytCfg.newValue);
      paintTheater();
    }
  });
} catch {}
paint();
// ---- Theater: windowed fullscreen ----
let th = Object.assign({ enabled: 0, wfs: 0, remember: 1, shortcut: 1 }, store.get('ytCfg', {}));
function thEnsureShape(){ if (typeof th.wfs !== 'number') th.wfs = th.wfs ? 1 : 0; if (typeof th.remember !== 'number') th.remember = th.remember ? 1 : 1; if (typeof th.shortcut !== 'number') th.shortcut = th.shortcut ? 1 : 1; }
thEnsureShape();
let pushTh = null;
function saveTh() {
  thEnsureShape();
  const clean = { enabled: th.enabled ? 1 : 0, wfs: th.wfs ? 1 : 0, remember: th.remember ? 1 : 0, shortcut: th.shortcut ? 1 : 0 };
  th = clean;
  store.set('ytCfg', clean);
  try { chrome.storage.local.set({ frostline_ytCfg: clean }); } catch {}
  clearTimeout(pushTh);
  pushTh = setTimeout(() => { try { chrome.runtime.sendMessage({ cmd: 'theater-apply' }, () => { void chrome.runtime.lastError; }); } catch {} }, 150);
}
function paintTheater() {
  thEnsureShape();
  const t = document.querySelector('#pp-t-toggle');
  if (t) t.classList.toggle('on', !!th.enabled);
}
// The worker probes the resolved page state, because injected CSS outlives the
// service worker: it can lose all record of a rule it is still responsible for.
// That disagreement is what turns these buttons red.
function wireRefresh(btnId, statusCmd, resetCmd) {
  const btn = document.querySelector('#' + btnId);
  if (!btn) return;
  const show = (st) => {
    btn.classList.toggle('pending', !!(st && st.mismatch));
  };
  btn.onclick = () => {
    btn.classList.add('busy');
    try {
      chrome.runtime.sendMessage({ cmd: resetCmd }, (r) => {
        void chrome.runtime.lastError;
        btn.classList.remove('busy');
        // The reset response already carries its final verification result,
        // so show that instead of racing a separate status request against it.
        if(r&&r.state)show(r.state);
        else{
          setTimeout(() => {
            try { chrome.runtime.sendMessage({ cmd: statusCmd }, (st) => { void chrome.runtime.lastError; show(st); }); } catch {}
          }, 300);
        }
      });
    } catch { btn.classList.remove('busy'); }
  };
  try { chrome.runtime.sendMessage({ cmd: statusCmd }, (st) => { void chrome.runtime.lastError; show(st); }); } catch {}
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      const key = statusCmd === 'shade-status' ? 'frostline_shadeState' : 'frostline_theaterState';
      if (ch[key]) show(ch[key].newValue);
    });
  } catch {}
}
wireRefresh('pp-rdim', 'shade-status', 'shade-reset');
wireRefresh('pp-rt', 'theater-status', 'theater-reset');
document.querySelector('#pp-t-toggle').onclick = () => { th.enabled = th.enabled ? 0 : 1; saveTh(); paintTheater(); };
// Adopt the worker's copy as the starting state, mirroring adoptDim/adoptExp:
// a fresh install writes enabled here, which localStorage alone never sees.
function adoptYt(next) {
  if (!next || typeof next !== 'object') return;
  th = Object.assign(th, next);
  thEnsureShape();
  store.set('ytCfg', th);
}
try {
  chrome.storage.local.get('frostline_ytCfg', o => { try { adoptYt(o && o.frostline_ytCfg); } catch {} paintTheater(); });
} catch {}
paintTheater();
try{const pv=document.querySelector('#pp-ver');if(pv)pv.textContent='v'+chrome.runtime.getManifest().version;}catch{}
// ---- Experimental Features: volume boost + ambient light ----
// The content script reacts to chrome.storage writes; localStorage here is
// only for synchronous first paint, matching dim/th.
let exp = Object.assign({ volume: 0, volGain: 100, ambient: 0, expOpen: 0, onlyVideo: 0, ovHideComments: 0 }, store.get('expCfg', {}));
function expEnsureShape(){
  exp.volume = exp.volume ? 1 : 0;
  exp.ambient = exp.ambient ? 1 : 0;
  exp.onlyVideo = exp.onlyVideo ? 1 : 0;
  // Only takes effect while Only Video is on: the child row is not rendered
  // otherwise, so a stored value cannot hide comments on its own.
  exp.ovHideComments = exp.ovHideComments ? 1 : 0;
  exp.expOpen = exp.expOpen ? 1 : 0;
  const n = typeof exp.volGain === 'number' && isFinite(exp.volGain) ? Math.round(exp.volGain) : 100;
  exp.volGain = Math.min(300, Math.max(100, n));
}
expEnsureShape();
function saveExp(){
  expEnsureShape();
  const clean = { volume: exp.volume ? 1 : 0, volGain: exp.volGain, ambient: exp.ambient ? 1 : 0, expOpen: exp.expOpen ? 1 : 0, onlyVideo: exp.onlyVideo ? 1 : 0, ovHideComments: exp.ovHideComments ? 1 : 0 };
  exp = clean;
  store.set('expCfg', clean);
  try { chrome.storage.local.set({ frostline_expCfg: clean }); } catch {}
}
function paintExp(){
  expEnsureShape();
  const vt = document.querySelector('#pp-vol-toggle');
  if (vt) vt.classList.toggle('on', !!exp.volume);
  const g = document.querySelector('#pp-vol-gain');
  const grow = document.querySelector('#pp-vol-row');
  // The gain slider only exists while Volume Boost is on: no toggle, no slider.
  // The caret folds it away as well.
  const volOpen = exp.volume && !!ui.vol;
  if (grow) grow.style.display = volOpen ? '' : 'none';
  const vc = document.querySelector('#pp-vol-caret');
  if (vc) { vc.classList.toggle('open', !!ui.vol); vc.setAttribute('aria-expanded', ui.vol ? 'true' : 'false'); vc.disabled = !exp.volume; }
  if (g && document.activeElement !== g) {
    g.value = exp.volGain;
    // Update fill gradient: 100->0%, 300->100%
    const pct = Math.round((exp.volGain - 100) / 2);
    g.style.background = 'linear-gradient(#0a84ff,#0a84ff) 0 50%/' + pct + '% 4px no-repeat,rgba(120,120,128,.3) 0 50%/100% 4px no-repeat';
  }
  const gv = document.querySelector('#pp-vol-val');
  if (gv) gv.textContent = exp.volGain + '%';
  if (gv) gv.classList.toggle('preview', exp.volGain > 200);
  const at = document.querySelector('#pp-amb-toggle');
  if (at) at.classList.toggle('on', !!exp.ambient);
  const ot = document.querySelector('#pp-ov-toggle');
  if (ot) ot.classList.toggle('on', !!exp.onlyVideo);
  const ohc = document.querySelector('#pp-ovhc-toggle');
  if (ohc) ohc.classList.toggle('on', !!exp.ovHideComments);
  // Same gate as the volume slider: the child toggle only exists while its
  // parent is on, so a disabled Only Video cannot leave a stray switch visible.
  const ovOpen = exp.onlyVideo && !!ui.ov;
  const ovc = document.querySelector('#pp-ov-row');
  if (ovc) ovc.style.display = ovOpen ? '' : 'none';
  const oc = document.querySelector('#pp-ov-caret');
  if (oc) { oc.classList.toggle('open', !!ui.ov); oc.setAttribute('aria-expanded', ui.ov ? 'true' : 'false'); oc.disabled = !exp.onlyVideo; }
  const head = document.querySelector('#exp-head');
  if (head) head.classList.toggle('open', !!exp.expOpen);
  const body = document.querySelector('#exp-body');
  if (body) body.classList.toggle('open', !!exp.expOpen);
}
document.querySelector('#exp-head').onclick = () => { exp.expOpen = exp.expOpen ? 0 : 1; saveExp(); paintExp(); };
document.querySelector('#pp-vol-toggle').onclick = () => {
  exp.volume = exp.volume ? 0 : 1;
  // Enabling at the 100% floor would be a silent no-op (unity gain), which
  // reads as broken. Nudge to a perceptible default so ON means audible.
  if (exp.volume && exp.volGain <= 100) exp.volGain = 150;
  saveExp();
  paintExp();
};
document.querySelector('#pp-vol-gain').oninput = e => { 
  exp.volGain = +e.target.value; 
  const pct = Math.round((exp.volGain - 100) / 2);
  e.target.style.background = 'linear-gradient(#0a84ff,#0a84ff) 0 50%/' + pct + '% 4px no-repeat,rgba(120,120,128,.3) 0 50%/100% 4px no-repeat';
  saveExp(); 
  paintExp(); 
};
document.querySelector('#pp-amb-toggle').onclick = () => { exp.ambient = exp.ambient ? 0 : 1; saveExp(); paintExp(); };
document.querySelector('#pp-ov-toggle').onclick = () => {
  exp.onlyVideo = exp.onlyVideo ? 0 : 1;
  // Turning Only Video on deliberately leaves Hide Comments as it was: enabling
  // the parent must not silently strip the comments too.
  saveExp();
  paintExp();
};
document.querySelector('#pp-ovhc-toggle').onclick = () => { exp.ovHideComments = exp.ovHideComments ? 0 : 1; saveExp(); paintExp(); };
// Disclosure carets fold each block's sub-controls away. They are view state,
// so they are kept out of the feature configs the worker also writes.
const cShade = document.querySelector('#pp-shade-caret');
if (cShade) cShade.onclick = () => { ui.shade = ui.shade ? 0 : 1; saveUi(); paint(); };
const cVol = document.querySelector('#pp-vol-caret');
if (cVol) cVol.onclick = () => { ui.vol = ui.vol ? 0 : 1; saveUi(); paintExp(); };
const cOv = document.querySelector('#pp-ov-caret');
if (cOv) cOv.onclick = () => { ui.ov = ui.ov ? 0 : 1; saveUi(); paintExp(); };
try {
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.frostline_expCfg && ch.frostline_expCfg.newValue) {
      exp = Object.assign(exp, ch.frostline_expCfg.newValue);
      paintExp();
    }
  });
} catch {}
// Adopt the worker's copy as the starting state, mirroring adoptDim: a fresh
// install writes expOpen expanded, which localStorage alone would never see.
function adoptExp(next) {
  if (!next || typeof next !== 'object') return;
  exp = Object.assign(exp, next);
  expEnsureShape();
  store.set('expCfg', exp);
}
try {
  chrome.storage.local.get('frostline_expCfg', o => { try { adoptExp(o && o.frostline_expCfg); } catch {} paintExp(); });
} catch {}
// Same for the disclosure state: localStorage alone would miss a value written
// by an earlier session that only reached chrome.storage.
try {
  chrome.storage.local.get('frostline_popupUI', o => { try { if (o && o.frostline_popupUI) { ui = Object.assign({}, UI_DEF, o.frostline_popupUI); store.set('popupUI', ui); } } catch {} paint(); paintExp(); });
} catch {}
paintExp();
