// Frostline toolbar popup: quick Shade + Theater control (same storage as the newtab page)
const store = {
  get: (k, d) => { try { const v = localStorage.getItem('frostline_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('frostline_' + k, JSON.stringify(v)); } catch {} },
};
let dim = Object.assign({ enabled: 0, intensity: 40, white: 1, dark: 0, fx: { dimmer: 1 }, vals: { dimmer: 45, reader: 75, blur: 50 }, edit: 'dimmer', scope: 'page' }, store.get('dimmerCfg', {}));
function dimEnsureShapeP(){
  dim.fx = dim.fx || {};
  // The fresh-install seed writes vals:{0,0,0} and fx:{dimmer:1,reader:0,blur:0}.
  // Object.assign cannot repair explicit zeros, so a seeded config keeps every
  // value at 0 and dimCss renders nothing. Repair zeros here instead.
  const DEF = { dimmer: 45, reader: 75, blur: 50 };
  dim.vals = Object.assign({}, DEF, dim.vals || {});
  for (const k of ['dimmer', 'reader', 'blur']) {
    if (typeof dim.vals[k] !== 'number' || !isFinite(dim.vals[k]) || dim.vals[k] <= 0) dim.vals[k] = DEF[k];
  }
  if (!['dimmer', 'reader', 'blur'].includes(dim.edit)) dim.edit = 'dimmer';
  // The active effect must be armed, or dimCss zeroes it out and paints nothing.
  if (!dim.fx.dimmer && !dim.fx.reader && !dim.fx.blur) dim.fx.dimmer = 1;
  dim.fx[dim.edit] = 1;
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
  const v = +e.target.value;
  dim.vals[dim.edit] = v;
  // Dragging the slider also implies "turn this effect on", and a non-zero value
  // is what makes dimCss emit anything for it.
  if (v > 0) dim.fx[dim.edit] = 1;
  saveDim();
  paint();
};
// Selecting a mode must also arm its fx flag. dimCss() gates every effect on
// cfg.fx, so setting only dim.edit left fx.reader/fx.blur at 0 and the overlay
// rendered nothing at all - the "Reader/Blur gives up" symptom.
document.querySelectorAll('#pp-mode button').forEach(b => b.onclick = () => {
  const k = b.dataset.m;
  dimEnsureShapeP();
  dim.edit = k;
  dim.fx[k] = 1;
  // A zero value for the newly selected effect renders nothing; give it a
  // sensible default so the mode always does something visible.
  if (typeof dim.vals[k] !== 'number' || dim.vals[k] <= 0) dim.vals[k] = k === 'blur' ? 50 : 75;
  saveDim();
  paint();
});
document.querySelectorAll('#pp-scope button').forEach(b => b.onclick = () => { dimEnsureShapeP(); const k = dim.edit || 'dimmer'; if (b.dataset.s === 'media' && k === 'reader') { b.classList.add('denied'); setTimeout(() => b.classList.remove('denied'), 650); return; } dim.scopes[k] = b.dataset.s; saveDim(); paint(); });

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
