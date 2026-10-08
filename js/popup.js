// Frostline toolbar popup: quick Shade + Theater control (same storage as the newtab page)
const store = {
  get: (k, d) => { try { const v = localStorage.getItem('frostline_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('frostline_' + k, JSON.stringify(v)); } catch {} },
};
let dim = Object.assign({ enabled: 0, intensity: 40, white: 1, dark: 0, fx: { dimmer: 1 }, vals: { dimmer: 45, reader: 75, blur: 50 }, edit: 'dimmer', scope: 'page' }, store.get('dimmerCfg', {}));
function dimEnsureShapeP(){
  dim.fx = dim.fx || {};
  // Fill in MISSING values only; a stored 0 is a deliberate choice and is kept.
  const DEF = { dimmer: 45, reader: 75, blur: 50 };
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
  const r = document.querySelector('#pp-intensity');
  dimEnsureShapeP();
  if (r && document.activeElement !== r) r.value = dim.vals[dim.edit];
  const v = document.querySelector('#pp-val');
  if (v) v.textContent = dim.vals[dim.edit] + '% — ' + (dim.edit === 'dimmer' ? 'dim' : dim.edit);
  document.querySelectorAll('#pp-mode button').forEach(b => { const sel = dim.edit === b.dataset.m; b.classList.toggle('on', sel); b.classList.toggle('edit', sel); });
  document.querySelectorAll('#pp-scope button').forEach(b => b.classList.toggle('on', b.dataset.s === ((dim.scopes || {})[dim.edit || 'dimmer'] || 'page')));
}
document.querySelector('#pp-toggle').onclick = () => { dim.enabled = dim.enabled ? 0 : 1; saveDim(); paint(); };
document.querySelector('#pp-intensity').oninput = e => {
  dimEnsureShapeP();
  dim.vals[dim.edit] = +e.target.value;
  dim.mode = dim.edit;
  // 0 is a valid "off" value; anything above 0 arms the effect.
  dim.fx[dim.edit] = (+e.target.value > 0) ? 1 : 0;
  saveDim();
  paint();
};
// Modes are exclusive, so selecting one must also make it the active mode and
// carry over the currently shown scope. Otherwise dimCss keeps painting the
// previous effect, which is why Reader showed a black screen and why the
// scope buttons appeared to apply to the wrong mode.
document.querySelectorAll('#pp-mode button').forEach(b => b.onclick = () => {
  const k = b.dataset.m;
  dimEnsureShapeP();
  const cur = dim.scopes[dim.edit] || 'page';
  dim.edit = k;
  dim.mode = k;
  dim.scopes[k] = cur;
  dim.fx[k] = 1;
  // Give a never-configured mode a visible starting value, but never override a
  // value the user has deliberately set to 0.
  if (typeof dim.vals[k] !== 'number' || !isFinite(dim.vals[k])) dim.vals[k] = k === 'blur' ? 50 : 75;
  saveDim();
  paint();
});
// Scope applies to the active mode only. Media is now valid for every mode
// including Reader - the old denial left Reader with no reachable media path.
document.querySelectorAll('#pp-scope button').forEach(b => b.onclick = () => {
  dimEnsureShapeP();
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
let th = Object.assign({ enabled: 0, wfs: 1, remember: 1, shortcut: 1 }, store.get('ytCfg', {}));
function thEnsureShape(){ if (typeof th.wfs !== 'number') th.wfs = th.wfs ? 1 : 1; if (typeof th.remember !== 'number') th.remember = th.remember ? 1 : 1; if (typeof th.shortcut !== 'number') th.shortcut = th.shortcut ? 1 : 1; }
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
document.querySelector('#pp-t-toggle').onclick = () => { th.enabled = th.enabled ? 0 : 1; saveTh(); paintTheater(); };
paintTheater();
