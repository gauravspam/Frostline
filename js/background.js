// Frostline Discard engine (MV3 service worker: auto-scheduler + manual actions)
const DISC_DEF={enabled:0,idle:15,grace:60,minTabs:3,neverActive:1,neverAudible:1,neverPinned:1,neverForm:1,whitelist:'',memPressure:0,memThreshold:20};
async function discCfg(){try{const o=await chrome.storage.local.get('frostline_discardCfg');return Object.assign({},DISC_DEF,o.frostline_discardCfg||{});}catch{return Object.assign({},DISC_DEF);}}
function discHost(u){try{return new URL(u).hostname.toLowerCase();}catch{return'';}}
function discWl(cfg){return String(cfg.whitelist||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);}
function discardable(t,cfg,spareId,force){
  if(!t||t.id===spareId)return false;
  const u=t.url||'';
  if(!/^https?:\/\//i.test(u))return false;
  if(!force&&cfg.neverActive&&t.active)return false;
  if(!force&&cfg.neverAudible&&t.audible)return false;
  if(cfg.neverPinned&&t.pinned)return false;
  const h=discHost(u),wl=discWl(cfg);
  if(wl.some(w=>h===w||h.endsWith('.'+w)))return false;
  return true;
}
async function markTitle(id,sleeping){
  try{
    await chrome.scripting.executeScript({target:{tabId:id},func:zzz=>{try{const t=document.title||'';if(zzz){if(!/^\u{1F4A4} /.test(t))document.title='\u{1F4A4} '+t;}else{document.title=t.replace(/^\u{1F4A4} /,'');}}catch{}},args:[!!sleeping]});
    return{ok:true};
  }catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}
}
async function saveDiscStatus(patch){try{const o=await chrome.storage.local.get('frostline_discStatus');const s=Object.assign({ts:0,checked:0,discarded:0,failed:0},o.frostline_discStatus||{},patch||{},{});s.ts=Date.now();await chrome.storage.local.set({frostline_discStatus:s});return s;}catch{return null;}}async function autoDiscard(){
  const cfg=await discCfg();
  if(!cfg.enabled)return;
  let tabs=[];try{tabs=await chrome.tabs.query({});}catch{return;}
  let force=false;
  if(cfg.memPressure){try{const mi=await chrome.system.memory.getInfo();const free=mi.capacity?100*mi.availableCapacity/mi.capacity:100;if(free<cfg.memThreshold)force=true;}catch{}}
  const now=Date.now(),idleMs=Math.max(1,cfg.idle)*60e3;
  const cand=tabs.filter(t=>{
    if(!discardable(t,cfg,-1))return false;
    const last=t.lastAccessed||0;
    if(!last)return false;
    if(!force&&(now-last)<idleMs)return false;
    return true;
  });
  if(cand.length<Math.max(1,cfg.minTabs||1)){await saveDiscStatus({checked:tabs.length,discarded:0,failed:0});return{checked:tabs.length,discarded:0,failed:0};}
  let n=0,f=0,lastErr='';
  for(const t of cand){if(t.active)await parkActive(t);const m=await markTitle(t.id,true);if(m.ok){try{await chrome.tabs.discard(t.id);n++;}catch{}}else{f++;lastErr=m.err;}}
  await saveDiscStatus({checked:tabs.length,discarded:n,failed:f,lastErr:lastErr||''});
  return{checked:tabs.length,discarded:n,failed:f};
}
async function parkActive(t){
  if(!t||!t.active)return true;
  try{
    const sibs=(await chrome.tabs.query({windowId:t.windowId})).filter(x=>x.id!==t.id&&!x.discarded);
    sibs.sort((a,b)=>Math.abs(a.index-t.index)-Math.abs(b.index-t.index));
    if(!sibs.length)return false;
    await chrome.tabs.update(sibs[0].id,{active:true});
    return{ok:true};
  }catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}
}
async function releaseTabs(src){
  let tabs=[];try{tabs=await chrome.tabs.query(src?{windowId:src.windowId,discarded:true}:{discarded:true});}catch{return 0;}
  let n=0;for(const t of tabs){try{await chrome.tabs.reload(t.id);n++;}catch{}}
  return n;
}
async function manualDiscard(mode,src){
  const cfg=await discCfg();
  let tabs=[];try{tabs=await chrome.tabs.query({windowId:src?src.windowId:chrome.windows.WINDOW_ID_CURRENT});}catch{return 0;}
  tabs=tabs.slice().sort((a,b)=>a.index-b.index);
  const idx=src?src.index:-1;
  let targets=[];
  if(mode==='this')targets=src?[src]:[];
  else if(mode==='right')targets=tabs.filter(t=>t.index>idx);
  else if(mode==='left')targets=tabs.filter(t=>t.index<idx);
  else if(mode==='others')targets=tabs.filter(t=>src&&t.id!==src.id);
  else return 0;
  let n=0;
  for(const t of targets){
    if(!discardable(t,cfg,-1,mode==='this'))continue;
    if(t.active)await parkActive(t);
    await markTitle(t.id,true);
    try{await chrome.tabs.discard(t.id);n++;}catch{}
  }
  return n;
}
async function dimCfg(){try{const o=await chrome.storage.local.get('frostline_dimmerCfg');return Object.assign({enabled:0,intensity:40,white:1,dark:0,fx:{dimmer:1},vals:{dimmer:0,reader:0,blur:0},edit:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}},o.frostline_dimmerCfg||{});}catch{return{enabled:0,intensity:40,white:1,dark:0,fx:{dimmer:1},vals:{dimmer:0,reader:0,blur:0},edit:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}};}}
// Every dimCss result must be a complete, self-cancelling rule set, because the
// rule set is written wholesale rather than layered: both branches below always
// emit the neutralising rules for the page overlay (::before), the legacy overlay
// (::after) and the media filters.
const DIM_NEUTRAL = 'html.frostline-ov{--frostline-ov-bg:transparent!important;--frostline-ov-blur:0px!important}html.frostline-ov::before,html.frostline-ov::after{display:none!important}img,video,canvas,picture,[style*="background-image"]{filter:none!important}';
// Shade and Theater each own one stylesheet element and rewrite its text in full.
// insertCSS plus a worker side record of what was inserted could not be trusted:
// the service worker is evicted while the tab keeps its rules, so the record came
// back empty and removeCSS never ran. The stale rules then lived in the tab until
// the next navigation and had to be beaten by cascade order alone. Writing the
// text of a single element makes every previous state unrepresentable.
const DIM_SHEET = 'frostline-sheet-shade';
const TH_SHEET = 'frostline-sheet-theater';
async function sheetWrite(tabId,id,css){
  try{
    await chrome.scripting.executeScript({target:{tabId:tabId},args:[id,css||''],func:(sid,text)=>{
      try{
        var el=document.getElementById(sid);
        if(!text){if(el)el.remove();return;}
        if(!el){el=document.createElement('style');el.id=sid;(document.head||document.documentElement).appendChild(el);}
        if(el.textContent!==text)el.textContent=text;
      }catch(e){}
    }});
    return true;
  }catch(e){return false;}
}
// Shade modes are MUTUALLY EXCLUSIVE: the UI shows one mode (dim/reader/blur),
// one value and one scope. Only the active mode may paint. Treating all three
// as simultaneous layers stacked up to an alpha of 1.0, which is why switching
// to Reader showed a black screen instead of a warm tint, and why a deliberate
// 0% value still left a veil behind.
function dimCss(cfg,boost){
  const V=(k,fb)=>{const v=cfg.vals&&cfg.vals[k];return Math.min(100,Math.max(0,(typeof v==='number'?v:fb)))/100;};
  const DEF={dimmer:0,reader:0,blur:0};
  // A missing value falls back to its default; an explicit 0 is honoured.
  const vals=(cfg.vals&&typeof cfg.vals==='object')?cfg.vals:{};
  const FX=cfg.fx||{};
  const active=DEF[cfg.mode]!==undefined?cfg.mode:(DEF[cfg.edit]!==undefined?cfg.edit:'dimmer');
  const scope=(((cfg.scopes||{})[active])==='media')?'media':'page';
  const armed=!!(FX[active]!==undefined?FX[active]:1);
  const amt=armed?V(active,DEF[active]):0;
  const gate=(boost||0);
  let css='';
  if(cfg.dark)css+='html.frostline-darkdm{filter:invert(1) hue-rotate(180deg)!important;background:#111!important}html.frostline-darkdm img,html.frostline-darkdm video,html.frostline-darkdm canvas,html.frostline-darkdm picture{filter:invert(1) hue-rotate(180deg)!important}';
  if(amt<=0){
    // Nothing selected, or the value is genuinely 0. Neutralise everything a
    // previous mode installed so 0% is a true no-op.
    css+=DIM_NEUTRAL;
    css+='@media print{html.frostline-ov::before,html.frostline-ov::after{display:none!important}}';
    return{css};
  }
  if(scope==='media'){
    // Element filters cannot be hidden by page stacking contexts, so media
    // scope is the reliable path for images/video.
    const tot=Math.min(1,amt+((active==='dimmer'||active==='reader')?gate:0));
    let f='brightness('+Math.max(.15,1-tot*.85).toFixed(3)+')';
    if(active==='reader')f+=' sepia('+(amt*0.6).toFixed(2)+') saturate('+(1-amt*0.35).toFixed(2)+')';
    if(active==='blur')f+=' blur('+(amt*20).toFixed(1)+'px)';
    css+='img,video,canvas,picture,[style*="background-image"]{filter:'+f+'!important;transition:filter 150ms ease!important}';
    // Media scope paints with element filters, so the page overlay must stay off.
    // Neutralise it explicitly rather than relying on removal by a later insert.
    css+='html.frostline-ov{--frostline-ov-bg:transparent!important;--frostline-ov-blur:0px!important}html.frostline-ov::before,html.frostline-ov::after{display:none!important}';
  }else{
    // Page scope paints via an overlay on the top layer. A pseudo-element on the
    // root element is unreliable where the app promotes its root into a stacking
    // context of its own, so drive a real fixed overlay with custom properties.
    css+='html.frostline-ov::after{display:none!important}';
    // Page scope paints with element filters cleared; the overlay supplies the effect.
    css+='img,video,canvas,picture,[style*="background-image"]{filter:none!important}';
    const layers=[];let brad=0;
    if(active==='reader'){const wa=Math.min(0.42,amt*0.5);layers.push('linear-gradient(rgba(255,196,130,'+wa.toFixed(3)+'),rgba(255,196,130,'+wa.toFixed(3)+'))');}
    if(active==='blur'){brad=(amt*20).toFixed(1);layers.push('linear-gradient(rgba(0,0,0,'+(amt*0.25).toFixed(3)+'),rgba(0,0,0,'+(amt*0.25).toFixed(3)+'))');}
    let ba=active==='dimmer'?amt:0;
    if(active==='reader')ba=Math.min(0.55,amt*0.42);
    if(ba>0)layers.push('linear-gradient(rgba(0,0,0,'+ba.toFixed(3)+'),rgba(0,0,0,'+ba.toFixed(3)+'))');
    if(gate>0&&(active==='dimmer'||active==='reader'))layers.push('linear-gradient(rgba(0,0,0,'+gate.toFixed(3)+'),rgba(0,0,0,'+gate.toFixed(3)+'))');
    css+='html.frostline-ov{--frostline-ov-bg:'+(layers.length?layers.join(','):'transparent')+';--frostline-ov-blur:'+(brad||'0')+'px}';
    // Keep the page overlay BELOW the windowed player so Theater stays crisp:
    // windowed mode pins #movie_player as a fixed element, so any element that
    // paints above it (a full-viewport pseudo-element at max z-index) covers
    // the video instead of dimming it.
    css+='html.frostline-ov::before{content:""!important;position:fixed!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100vw!important;height:100vh!important;z-index:1!important;pointer-events:none!important;background:var(--frostline-ov-bg)!important;backdrop-filter:blur(var(--frostline-ov-blur))!important;-webkit-backdrop-filter:blur(var(--frostline-ov-blur))!important;margin:0!important;padding:0!important;border:0!important;transition:opacity 150ms ease,backdrop-filter 150ms ease!important}';
    css+='html.frostline-th-wfs.frostline-ov{--frostline-ov-bg:transparent!important;--frostline-ov-blur:0px!important}';
    // Hiding it outright beats any rule set an earlier build left behind. Those
    // pinned the overlay at the top of the stacking order with a backdrop-filter,
    // so they blurred the whole windowed player until the tab was reloaded.
    css+='html.frostline-th-wfs.frostline-ov::before{display:none!important}';
  }
  css+='@media print{html.frostline-ov::before,html.frostline-ov::after{display:none!important}}';
  return{css};
}
async function dimApply(tabId,cfg){
  try{
    if(!cfg.enabled){
      // Dropping frostline-ov makes every overlay rule inert on its own, because
      // they are all scoped to that class, and clearing the variables means a rule
      // that survives for any reason has nothing left to paint.
      try{await chrome.scripting.executeScript({target:{tabId:tabId},func:()=>{try{var o=document.getElementById('frostline-dimmer-ov');if(o)o.remove();var h=document.documentElement;h.classList.remove('frostline-darkdm','frostline-monly','frostline-ov');h.style.removeProperty('--frostline-ov-bg');h.style.removeProperty('--frostline-ov-blur');}catch(e){}}});}catch{}
      // Keep the self-cancelling rule set rather than emptying the element, so a
      // stale media-scope filter left by an earlier build still loses the cascade.
      await sheetWrite(tabId,DIM_SHEET,DIM_NEUTRAL);
      // Re-add the class so DIM_NEUTRAL rules match. Without the class, the
      // neutral rules don't apply and stale media-scope filters can leak through.
      try{await chrome.scripting.executeScript({target:{tabId:tabId},func:()=>{try{document.documentElement.classList.add('frostline-ov');}catch(e){}}});}catch{}
      return{ok:true};
    }
    let boost=0;
    if(cfg.white){try{const r=await chrome.scripting.executeScript({target:{tabId:tabId},func:()=>{try{var bg=getComputedStyle(document.body).backgroundColor||'';var m=bg.match(/[\d.]+/g);return(m&&m.length>=3)?((.299*m[0]+.587*m[1]+.114*m[2])/255):0;}catch(e){return 0;}}});const L=r&&r[0]&&r[0].result;if(typeof L==='number'&&L>.82)boost=.15;}catch{}}
    await chrome.scripting.executeScript({target:{tabId:tabId},func:(mode,dark)=>{try{var ov=document.getElementById('frostline-dimmer-ov');if(ov)ov.remove();}catch(e){}try{
      var h=document.documentElement;
      h.classList.toggle('frostline-darkdm',!!dark);
      h.classList.add('frostline-ov');
    }catch(e){}},args:[cfg.mode,!!cfg.dark]});
    const built=dimCss(cfg,boost);
    if(!await sheetWrite(tabId,DIM_SHEET,built.css))return{ok:false,err:'shade sheet not written'};
    return{ok:true};
  }catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}
}
async function dimApplyAll(){const cfg=await dimCfg();let tabs=[];try{tabs=await chrome.tabs.query({});}catch{return{ok:false};}
  let n=0,f=0,lastErr='';
  for(const t of tabs){if(!/^https?:\/\//i.test(t.url||''))continue;if(t.discarded)continue;try{const r=await dimApply(t.id,cfg);if(r&&r.ok)n++;else{f++;if(r&&r.err)lastErr=r.err;}}catch(e){f++;lastErr=String((e&&e.message)||e).slice(0,140);}}
  try{await chrome.storage.local.set({frostline_dimStatus:{ts:Date.now(),tabs:tabs.length,applied:n,failed:f,lastErr}});}catch{}
  await dimVerifyAll();
  return{ok:true,applied:n,failed:f};
}
// Reads the resolved page state rather than the config, because the two can
// disagree after a worker restart: injected CSS outlives the worker, so the
// worker can lose all record of a rule it is still responsible for.
async function dimProbe(tabId){
  try{
    const r=await chrome.scripting.executeScript({target:{tabId:tabId},func:()=>{try{
      var h=document.documentElement,g=getComputedStyle(h),b=getComputedStyle(h,'::before');
      var vs=document.querySelectorAll('#movie_player video');
      if(!vs.length)vs=document.querySelectorAll('video');
      var vf='none',shadeMedia=false;
      for(var i=0;i<vs.length;i++){
        try{
          var f=getComputedStyle(vs[i]).filter;
          if(i===0)vf=f;
          // Detect Shade media-scope fingerprint: brightness < 1 + optional sepia/saturate/blur
          if(f!=='none'){
            var m=f.match(/brightness\(([\d.]+)\)/);
            if(m&&parseFloat(m[1])<0.98){shadeMedia=true;break;}
          }
        }catch(e){}
      }
      return{ov:h.classList.contains('frostline-ov'),dm:h.classList.contains('frostline-darkdm'),
        bd:b.display,blur:g.getPropertyValue('--frostline-ov-blur').trim(),
        vf:vf,shadeMedia:shadeMedia};
    }catch(e){return null;}}}); 
    return(r&&r[0])?r[0].result:null;
  }catch{return null;}
}
function dimExpect(cfg){
  const DEF={dimmer:0,reader:0,blur:0};
  const vals=(cfg.vals&&typeof cfg.vals==='object')?cfg.vals:{};
  const FX=cfg.fx||{};
  const active=DEF[cfg.mode]!==undefined?cfg.mode:(DEF[cfg.edit]!==undefined?cfg.edit:'dimmer');
  const scope=(((cfg.scopes||{})[active])==='media')?'media':'page';
  const armed=!!(FX[active]!==undefined?FX[active]:1);
  const raw=(typeof vals[active]==='number'?vals[active]:DEF[active]);
  const amt=armed?Math.min(100,Math.max(0,raw))/100:0;
  return{paints:!!cfg.enabled&&amt>0,scope,active,amt};
}
// Only flag the one disagreement that is unambiguous and cannot false-positive:
// Shade is configured to paint nothing, yet the page is still painting an effect.
function dimMismatch(p,cfg){
  if(!p)return false;
  const e=dimExpect(cfg);
  const overlay=p.ov&&(parseFloat(p.blur||'0')>0||(p.bd&&p.bd!=='none'));
  const shadeMedia=p.shadeMedia;
  if(!e.paints){
    // Only flag if Shade-specific artifacts remain (overlay with actual blur/bg, or media filter).
    // The frostline-ov class alone is not a mismatch - it's needed for DIM_NEUTRAL to work.
    return overlay||shadeMedia;
  }
  if(e.scope==='media')return !shadeMedia;
  // Windowed Theater intentionally clears the page overlay, so its absence
  // is the expected state rather than drift.
  if(p.th)return false;
  return !overlay;
}
async function dimVerifyAll(){
  const cfg=await dimCfg();let tabs=[];try{tabs=await chrome.tabs.query({active:true,currentWindow:true});}catch{return null;}
  if(!tabs.length){try{tabs=await chrome.tabs.query({active:true});}catch{return null;}}
  const bad=[];
  for(const t of tabs){
    if(!/^https?:\/\//i.test(t.url||''))continue;
    if(t.discarded)continue;
    try{const p=await dimProbe(t.id);if(dimMismatch(p,cfg))bad.push(t.id);}catch{}
  }
  const st={mismatch:bad.length>0,ts:Date.now(),tabs:bad.length};
  try{await chrome.storage.local.set({frostline_shadeState:st});}catch{}
  return st;
}
// Force teardown of every tab regardless of what the worker still remembers,
// then re-apply. This is the escape hatch when the tracked state has drifted.
async function dimResetAll(){
  let tabs=[];try{tabs=await chrome.tabs.query({});}catch{return{ok:false};}
  let n=0;
  for(const t of tabs){
    if(!/^https?:\/\//i.test(t.url||''))continue;
    if(t.discarded)continue;
    try{
      await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>{try{
        var h=document.documentElement;
        h.classList.remove('frostline-ov','frostline-darkdm','frostline-monly');
        h.style.removeProperty('--frostline-ov-bg');h.style.removeProperty('--frostline-ov-blur');
        var o=document.getElementById('frostline-dimmer-ov');if(o)o.remove();
      }catch(e){}}});
      await sheetWrite(t.id,DIM_SHEET,DIM_NEUTRAL);
      // Re-add class so DIM_NEUTRAL matches
      try{await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>{try{document.documentElement.classList.add('frostline-ov');}catch(e){}}});}catch{}
      n++;
    }catch{}
  }
  // Re-apply with current config
  await dimApplyAll();
  // Allow time for CSS to settle, then verify
  await new Promise(r=>setTimeout(r,150));
  const state=await dimVerifyAll();
  return{ok:true,reset:n,state};
}
// Frostline Theater engine (YouTube: windowed fullscreen)
const TH_DEF={enabled:0,wfs:0,remember:1,shortcut:1};
async function theaterCfg(){try{const o=await chrome.storage.local.get('frostline_ytCfg');const c=Object.assign({},TH_DEF,o.frostline_ytCfg||{});if(typeof c.wfs!=='number')c.wfs=c.wfs?1:0;return c;}catch{return Object.assign({},TH_DEF);}}
function theaterVid(url){try{const u=new URL(url||'');const h=(u.hostname||'').toLowerCase();if(h.includes('youtube.com')){if(u.pathname==='/watch')return u.searchParams.get('v')||'';if(u.pathname.indexOf('/shorts/')===0)return u.pathname.split('/')[2]||'';return '';}if(h==='youtu.be'||h.endsWith('.youtu.be'))return (u.pathname||'').replace(/^\//,'').split('/')[0]||'';return '';}catch{return '';}}
function theaterIsYT(url){return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/)/i.test(url||'');}
async function theaterMem(){try{const o=await chrome.storage.local.get('frostline_theaterMem');return (o&&o.frostline_theaterMem)||{};}catch{return {};}}
async function theaterMemSave(mem){try{await chrome.storage.local.set({frostline_theaterMem:mem||{}});}catch{}}
// Apply and verification must use the same effective mode. Remembered
// per-video state overrides the global switch, so checking the global switch
// alone reports a correctly remembered page as mismatched.
async function theaterEffWfs(cfg,url){
  const vid=theaterVid(url||'');
  if(cfg.remember&&vid){
    try{const mem=await theaterMem();if(mem&&mem[vid])return{vid,wfs:mem[vid].wfs?1:0};}catch{}
  }
  return{vid,wfs:!!cfg.wfs};
}
// Tooltip pill for the injected Windowed-fullscreen button. Values are a 1:1
// transcription of YouTube's own modern (ytp-delhi-modern) control tooltip:
// container font 118%/500/15px, frosted wrapper rgba(0,0,0,.3) + blur(16px) +
// text-shadow, pill rgba(0,0,0,.3) + blur(16px) + radius 8px + padding 5px 9px,
// shortcut badge 1px rgba(255,255,255,.3) / radius 4px / min-width 11px.
const FROSTLINE_TIP_CSS = '#frostline-th-tip.ytp-tooltip{position:absolute!important;z-index:1003;pointer-events:none;font-size:118%;font-weight:500;line-height:15px;white-space:nowrap;display:block;opacity:0;transition:transform .2s cubic-bezier(.05,0,0,1),opacity .2s cubic-bezier(.05,0,0,1),top .2s cubic-bezier(.05,0,0,1)}#frostline-th-tip.ytp-tooltip[aria-hidden="false"]{opacity:1}#frostline-th-tip .ytp-tooltip-text-wrapper{border-radius:8px;background:rgba(0,0,0,.3);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);text-shadow:0 0 2px #000;opacity:0;transition:opacity .2s cubic-bezier(.05,0,0,1)}#frostline-th-tip[aria-hidden="false"] .ytp-tooltip-text-wrapper{opacity:1}#frostline-th-tip .ytp-tooltip-bottom-text{display:flex;align-items:center;background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;border-radius:8px;padding:5px 9px;width:-webkit-max-content;width:max-content}#frostline-th-tip .ytp-tooltip-text{white-space:nowrap}#frostline-th-tip .ytp-tooltip-bottom-text{width:-webkit-max-content;width:max-content}#frostline-th-tip .ytp-tooltip-keyboard-shortcut{display:flex;justify-content:center;align-items:center;border:1px solid rgba(255,255,255,.3);min-width:11px;border-radius:4px;margin-left:4px;color:#fff;padding:0 2px}';
function theaterCss(cfg){
  let css='';
  css+='@media print{html.frostline-th-wfs{overflow:visible!important}}';
  // Windowed mode makes #movie_player position:fixed, so the YouTube control bar
  // is absolutely positioned against a fixed ancestor. Pin our button to its
  // normal in-flow slot and stop it inheriting the translateY from the chrome
  // auto-hide animation, which otherwise parks it off-screen until the bar settles.
  css+='.frostline-th-btn{flex:0 0 auto!important;align-self:center!important;position:relative!important;opacity:1!important;visibility:visible!important;transform:none!important;translate:none!important;transition:none!important}';
  // Kill page scrolling while windowed: the fixed player covered the viewport, but
  // the document behind it kept its own scroll height and produced a stray
  // scrollbar. Size the player from the box rather than the viewport, since a
  // viewport width also includes the vertical scrollbar gutter.
  if(cfg.wfs)css+='html.frostline-th-wfs,html.frostline-th-wfs body{overflow:hidden!important;height:100%!important;margin:0!important;padding:0!important}';
  if(cfg.wfs)css+='html.frostline-th-wfs #primary,html.frostline-th-wfs #player-container-outer,html.frostline-th-wfs ytd-watch-flexy{width:100%!important;max-width:100%!important}';
  // inset:0 against a fixed root sizes the player to the viewport box without
  // pulling in the scrollbar gutter that a viewport width would add.
  if(cfg.wfs)css+='html.frostline-th-wfs #movie_player{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;transform:none!important;z-index:2147483647!important}';
  // YouTube sizes the inner video layer from the player's own aspect-ratio box,
  // so pinning the player alone leaves the frame letterboxed and offset inside
  // the viewport. Let the video layer fill the box and keep the frame intact.
  if(cfg.wfs)css+='html.frostline-th-wfs #movie_player .html5-video-player,html.frostline-th-wfs #movie_player .html5-video-container,html.frostline-th-wfs #movie_player video{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;left:0!important;top:0!important;transform:none!important;object-fit:contain!important;filter:none!important}';
  if(cfg.wfs)css+='html.frostline-th-wfs #masthead-container,html.frostline-th-wfs #secondary,html.frostline-th-wfs ytd-comments,html.frostline-th-wfs #below{display:none!important}html.frostline-th-wfs #content{padding-top:0!important}';
  // Disable Shade media-scope filters on YouTube when Theater is active.
  if(cfg.wfs)css+='html.frostline-th-wfs img,html.frostline-th-wfs video,html.frostline-th-wfs canvas,html.frostline-th-wfs picture,html.frostline-th-wfs [style*="background-image"]{filter:none!important}';
  css+=FROSTLINE_TIP_CSS;
  return{css};
}
function frostlineTheaterBoot(cfg){
  try{
    var wfs=!!cfg.wfs;
    var de=document.documentElement;
    // Windowed geometry comes from our fixed player rules alone. Clicking
    // YouTube's own theater toggle re-lays-out its player behind our back and
    // is not needed for the windowed frame.
    de.classList.toggle('frostline-th-wfs',wfs);
    de.classList.add('frostline-th');
    var exitTh=function(){try{var fx=document.querySelector('ytd-watch-flexy');var on=document.querySelector('ytd-watch-flexy[theater]')||(fx&&fx.hasAttribute('theater'));if(!on)return;var cands=[document.querySelector('.ytp-size-button'),document.querySelector('button.ytp-size-button')].filter(Boolean);for(var ci=0;ci<cands.length;ci++){try{cands[ci].click();}catch(_){}}if(fx&&fx.hasAttribute('theater')){try{fx.removeAttribute('theater');}catch(_){}}}catch(_){}};
    if(!wfs)exitTh();
    var rs=function(){try{window.dispatchEvent(new Event('resize'));}catch(_){}};
    rs();setTimeout(rs,300);
    var vid=function(){try{var u=new URL(location.href);if(u.hostname.indexOf('youtube.com')>=0){if(u.pathname==='/watch')return u.searchParams.get('v')||'';if(u.pathname.indexOf('/shorts/')===0)return u.pathname.split('/')[2]||'';}if(u.hostname==='youtu.be')return u.pathname.replace(/^\//,'').split('/')[0]||'';}catch(_){}return '';};
    var save=function(patch){var refresh=function(){try{if(chrome&&chrome.runtime&&chrome.runtime.sendMessage){chrome.runtime.sendMessage({cmd:'theater-apply'},function(){try{void chrome.runtime.lastError;}catch(_){}});}}catch(_){}};try{if(chrome&&chrome.storage&&chrome.storage.local){chrome.storage.local.get('frostline_ytCfg',function(o){try{var cur=((o&&o.frostline_ytCfg)||{});var c={enabled:1,wfs:cur.wfs?1:0,remember:(cur.remember===0?0:1),shortcut:(cur.shortcut===0?0:1)};Object.keys(patch||{}).forEach(function(k){c[k]=patch[k];});chrome.storage.local.set({frostline_ytCfg:c},function(){var v=vid();if(v&&c.remember){try{chrome.storage.local.get('frostline_theaterMem',function(m){try{var mem=((m&&m.frostline_theaterMem)||{});mem[v]={wfs:c.wfs?1:0};chrome.storage.local.set({frostline_theaterMem:mem},refresh);}catch(_){refresh();}});}catch(_){refresh();}}else{refresh();}});}catch(_){refresh();}});}}catch(_){refresh();}};
    var paintB=function(){var bw2=document.getElementById('frostline-th-wfs');if(bw2)bw2.setAttribute('aria-checked',wfs?'true':'false');};
    var tipRaf=0;
    var tipHide=function(){try{if(tipRaf){cancelAnimationFrame(tipRaf);tipRaf=0;}}catch(_){}try{var t=document.getElementById('frostline-th-tip');if(t)t.remove();}catch(_){}};
    // YouTube translates .ytp-chrome-bottom while the chrome fades in and re-lays-out
    // the bar when buttons come and go, so a pill placed once on mouseenter drifts
    // off its button. Track the anchor each frame while the pill is visible.
    var tipTrack=function(tip,anchor,host){var last='';var step=function(){tipRaf=0;
      try{if(!tip.isConnected||!anchor.isConnected){tipHide();return;}
        var ar=anchor.getBoundingClientRect(),hr=host.getBoundingClientRect();
        var key=Math.round(ar.left)+':'+Math.round(ar.top);
        if(key!==last){last=key;tip.style.left=(ar.left+ar.width/2-hr.left)+'px';tip.style.top=(ar.top-hr.top)+'px';}
      }catch(_){tipHide();return;}
      tipRaf=requestAnimationFrame(step);};
      tipRaf=requestAnimationFrame(step);};
    var tipShow=function(anchor){try{
      tipHide();
      if(!anchor||!anchor.isConnected)return;
      try{anchor.style.setProperty('position','relative','important');}catch(_){}
      try{anchor.style.setProperty('overflow','visible','important');}catch(_){}
      var tip=document.createElement('div');tip.id='frostline-th-tip';tip.className='ytp-tooltip ytp-bottom';tip.setAttribute('aria-hidden','false');tip.setAttribute('aria-live','polite');
      var wrap=document.createElement('div');wrap.className='ytp-tooltip-text-wrapper ytp-frosted-glass-fade-transition';
      var row=document.createElement('div');row.className='ytp-tooltip-bottom-text';
      var lb=document.createElement('span');lb.className='ytp-tooltip-text';try{lb.textContent='Windowed fullscreen';}catch(_){}
      var kb=document.createElement('div');kb.className='ytp-tooltip-keyboard-shortcut';try{kb.textContent='`';}catch(_){}
      row.appendChild(lb);row.appendChild(kb);
      wrap.appendChild(row);
      tip.appendChild(wrap);
      // NB: parent the pill to #movie_player, never to the controls bar. The bar is
      // only ~170px wide and an abs-positioned shrink-to-fit box is capped by its
      // containing block, so the label wraps to two lines and the pill renders as
      // a tall dark rectangle. Native YouTube parents tooltips to the player.
      tip.style.cssText='position:absolute;pointer-events:none;display:block;white-space:nowrap;width:max-content;';
      var host=document.getElementById('movie_player');
      if(!host){var pp=anchor.parentNode;while(pp&&pp.id!=='movie_player')pp=pp.parentNode;host=(pp&&pp.id==='movie_player')?pp:null;}
      if(!host){anchor.prepend(tip);return;}
      try{host.style.setProperty('position','relative','important');}catch(_){}
      host.appendChild(tip);
      var ar=anchor.getBoundingClientRect(),hr=host.getBoundingClientRect();
      tip.style.left=(ar.left+ar.width/2-hr.left)+'px';tip.style.top=(ar.top-hr.top)+'px';
      tip.style.marginTop='-12px';tip.style.transform='translateX(-50%) translateY(-100%)';
      tipTrack(tip,anchor,host);
    }catch(_){}};
    var visBar=function(){var pick=function(s){try{var n=document.querySelector(s);if(n&&n.isConnected)return n;}catch(_){}return null;};var g=pick('#movie_player .ytp-settings-button')||pick('.ytp-settings-button');if(g&&g.parentNode){var p=g.parentNode;while(p&&p.nodeType===1){if(p.classList&&(p.classList.contains('ytp-right-controls')||p.classList.contains('ytp-chrome-controls')))return p;if(p.id==='movie_player')break;p=p.parentNode;}return g.parentNode;}return pick('#movie_player .ytp-right-controls')||pick('.ytp-right-controls')||pick('.ytp-chrome-controls .ytp-right-controls')||pick('.html5-video-player .ytp-right-controls')||pick('.ytp-chrome-controls')||pick('#movie_player');};
    var inject=function(){
      try{
        var ex0=document.getElementById('frostline-th-wfs');
        if(ex0&&ex0.isConnected&&ex0.dataset.frostlineBv==='16'){paintB();return true;}
        if(ex0){try{ex0.remove();}catch(_){}}
        var sx0=document.getElementById('frostline-th-str');if(sx0){try{sx0.remove();}catch(_){}}
        var bar=visBar();
        if(!bar)return false;
        var mk=function(id,title,svg){var b=document.createElement('button');b.className='ytp-button frostline-th-btn';b.id=id;b.dataset.frostlineBv='16';b.title=title;b.setAttribute('aria-label',title);b.setAttribute('role','switch');b.setAttribute('aria-checked','false');b.innerHTML=svg;return b;};
        var svgW='<svg height="24" viewBox="0 0 24 24" width="24"><path d="M3 3h6v2H5v4H3V3zm18 0h-6v2h4v4h2V3zM3 21h6v-2H5v-4H3v6zm18 0h-6v-2h4v-4h2v6z" fill="white"/></svg>';
        var bw=mk('frostline-th-wfs','Windowed fullscreen (`)',svgW);
        bw.onclick=function(e){e.preventDefault();e.stopPropagation();wfs=!wfs;de.classList.toggle('frostline-th-wfs',wfs);rs();setTimeout(rs,300);paintB();save({wfs:wfs?1:0});};
        try{bw.addEventListener('mouseenter',function(){tipShow(bw);});bw.addEventListener('mouseleave',tipHide);}catch(_){}
        var anchor=bar.querySelector('.ytp-settings-button');
        var host=anchor?anchor.parentNode:bar;
        if(anchor){host.insertBefore(bw,anchor);}else{bar.insertBefore(bw,bar.firstChild);}
        paintB();
        return true;
      }catch(_){return false;}
    };
    if(window.__frostlineThBtnIv){try{clearInterval(window.__frostlineThBtnIv);}catch(_){}window.__frostlineThBtnIv=0;}
    // YouTube rebuilds .ytp-right-controls on quality changes, theater toggles
    // and fullscreen transitions, which destroys the injected button. Watch the
    // bar and re-inject when it goes missing, otherwise the control stays absent
    // until the page is reloaded.
    if(!window.__frostlineThObs){
      try{
        var last=0;
        var ob=new MutationObserver(function(){
          var cur=document.getElementById('frostline-th-wfs');
          if(cur&&cur.isConnected&&cur.dataset.frostlineBv==='16')return;
          var now=Date.now();if(now-last<400)return;last=now;
          try{inject();}catch(_){}
        });
        window.__frostlineThObs=ob;
        ob.observe(document.body,{childList:true,subtree:true});
      }catch(_){}
    }
    if(!inject()){try{window.__frostlineThBtnIv=setInterval(function(){if(inject()){try{clearInterval(window.__frostlineThBtnIv);}catch(_){}window.__frostlineThBtnIv=0;}},1000);}catch(_){}}
  }catch(_){}
}
function frostlineTheaterOff(){
  try{tipHide();}catch(_){}
  try{
    try{document.documentElement.classList.remove('frostline-th-wfs','frostline-th');}catch(_){}
    if(window.__frostlineThIv){try{clearInterval(window.__frostlineThIv);}catch(_){}try{window.__frostlineThIv=0;}catch(_){}}
    if(window.__frostlineThBtnIv){try{clearInterval(window.__frostlineThBtnIv);}catch(_){}try{window.__frostlineThBtnIv=0;}catch(_){}}
    try{var a=document.getElementById('frostline-th-wfs');if(a)a.remove();}catch(_){}
    try{var s=document.getElementById('frostline-th-str');if(s)s.remove();}catch(_){}
    var v=document.querySelector('video');if(v){v.style.transform='';try{v.style.objectFit='';}catch(_){}}
    try{window.dispatchEvent(new Event('resize'));}catch(_){}
  }catch(_){}
}

async function theaterApply(tabId,cfg,url){
  try{
    if(!theaterIsYT(url||'')){
      await sheetWrite(tabId,TH_SHEET,'');
      return{ok:true,skipped:true};
    }
    const memWfs=await theaterEffWfs(cfg,url);
    const vid=memWfs.vid;
    let eff=Object.assign({},cfg,{wfs:memWfs.wfs?1:0});
    if(!eff.enabled){
      try{await chrome.scripting.executeScript({target:{tabId:tabId},func:frostlineTheaterOff});}catch{}
      await sheetWrite(tabId,TH_SHEET,'');
      return{ok:true};
    }
    const built=theaterCss(eff);
    if(!await sheetWrite(tabId,TH_SHEET,built.css))return{ok:false,err:'theater sheet not written'};
    try{await chrome.scripting.executeScript({target:{tabId:tabId},func:frostlineTheaterBoot,args:[{wfs:!!eff.wfs}]});}catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}
    if(cfg.remember&&vid){
      try{const mem2=await theaterMem();mem2[vid]={wfs:eff.wfs?1:0};await theaterMemSave(mem2);}catch{}
    }
    return{ok:true};
  }catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}
}
async function theaterApplyAll(){
  const cfg=await theaterCfg();
  let tabs=[];try{tabs=await chrome.tabs.query({});}catch{return{ok:false};}
  let n=0,f=0,lastErr='';
  for(const t of tabs){
    if(!theaterIsYT(t.url||''))continue;
    if(t.discarded)continue;
    try{const r=await theaterApply(t.id,cfg,t.url);if(r&&r.ok)n++;else{f++;if(r&&r.err)lastErr=r.err;}}catch(e){f++;lastErr=String((e&&e.message)||e).slice(0,140);}
  }
  try{await chrome.storage.local.set({frostline_theaterStatus:{ts:Date.now(),tabs:n,applied:n,failed:f,lastErr}});}catch{}
  await theaterVerifyAll();
  return{ok:true,applied:n,failed:f};
}
async function theaterProbe(tabId){
  try{
    const r=await chrome.scripting.executeScript({target:{tabId:tabId},func:()=>{try{
      var h=document.documentElement,p=document.getElementById('movie_player');
      return{wfs:h.classList.contains('frostline-th-wfs'),
        btn:!!document.getElementById('frostline-th-wfs'),
        fixed:!!p&&getComputedStyle(p).position==='fixed'};
    }catch(e){return null;}}});
    return(r&&r[0])?r[0].result:null;
  }catch{return null;}
}
function theaterMismatch(p,cfg){
  if(!p)return false;
  const on=!!(cfg&&cfg.enabled);
  if(!on)return p.wfs||p.btn||p.fixed;
  if(!cfg.wfs)return p.wfs||p.fixed;
  return !p.wfs||!p.fixed;
}
async function theaterVerifyAll(){
  const cfg=await theaterCfg();let tabs=[];try{tabs=await chrome.tabs.query({active:true,currentWindow:true});}catch{return null;}
  if(!tabs.length){try{tabs=await chrome.tabs.query({active:true});}catch{return null;}}
  const bad=[];
  for(const t of tabs){
    if(!theaterIsYT(t.url||''))continue;
    if(t.discarded)continue;
    try{const p=await theaterProbe(t.id);const eff=Object.assign({},cfg,{wfs:(await theaterEffWfs(cfg,t.url||'')).wfs?1:0});if(theaterMismatch(p,eff))bad.push(t.id);}catch{}
  }
  const st={mismatch:bad.length>0,ts:Date.now(),tabs:bad.length};
  try{await chrome.storage.local.set({frostline_theaterState:st});}catch{}
  return st;
}
// Force teardown of every tab regardless of what the worker still remembers,
// then re-apply. This is the escape hatch when the tracked state has drifted.
async function theaterResetAll(){
  let tabs=[];try{tabs=await chrome.tabs.query({});}catch{return{ok:false};}
  let n=0;
  for(const t of tabs){
    if(!theaterIsYT(t.url||''))continue;
    if(t.discarded)continue;
    try{
      await chrome.scripting.executeScript({target:{tabId:t.id},func:frostlineTheaterOff});
      await sheetWrite(t.id,TH_SHEET,'');
      n++;
    }catch{}
  }
  await theaterApplyAll();
  await new Promise(r=>setTimeout(r,150));
  const state=await theaterVerifyAll();
  return{ok:true,reset:n,state};
}
chrome.tabs.onActivated.addListener(async info=>{try{const id=info&&info.tabId;if(!id)return;const dc=await dimCfg();await dimApply(id,dc);let url='';try{const g=await chrome.tabs.get(id);url=g.url||'';}catch{}const tc=await theaterCfg();await theaterApply(id,tc,url);await dimVerifyAll();await theaterVerifyAll();}catch{}});
chrome.tabs.onUpdated.addListener((id,info,tab)=>{if(info&&info.status==='complete'){(async()=>{try{const dc=await dimCfg();await dimApply(id,dc);}catch{}try{let url=(tab&&tab.url)||'';if(!url){try{const g=await chrome.tabs.get(id);url=g.url||'';}catch{}}const tc=await theaterCfg();await theaterApply(id,tc,url);}catch{}try{await dimVerifyAll();await theaterVerifyAll();}catch{}})();}});
// YouTube is an SPA - internal navigation doesn't fire onUpdated. Use webNavigation
// to re-verify after each YouTube page transition.
try{chrome.webNavigation.onCompleted.addListener(async d=>{if(!d||!d.url||!theaterIsYT(d.url))return;try{const dc=await dimCfg();await dimApply(d.tabId,dc);const tc=await theaterCfg();await theaterApply(d.tabId,tc,d.url);await dimVerifyAll();await theaterVerifyAll();}catch{}});}catch{}
function setupDiscardMenus(){try{const contexts=['page'];if(chrome.contextMenus.ContextType&&chrome.contextMenus.ContextType.TAB)contexts.unshift('tab');chrome.contextMenus.removeAll(()=>{
  chrome.contextMenus.create({id:'frostline-disc',title:'Discard Tabs',contexts});
  [['this','Discard this tab'],['right','Discard tabs to the right'],['left','Discard tabs to the left'],['others','Discard all other tabs'],['release','Release all tabs']].forEach(([id,title])=>chrome.contextMenus.create({id:'frostline-disc-'+id,parentId:'frostline-disc',title,contexts}));
});}catch{}}
chrome.runtime.onInstalled.addListener(details=>{try{chrome.alarms.create('frostline-discard',{periodInMinutes:1});}catch{}setupDiscardMenus();try{if(details&&details.reason==='install'&&chrome.storage&&chrome.storage.local){chrome.storage.local.get(null,all=>{try{const set={};if(!all||!('frostline_discardCfg' in all))set.frostline_discardCfg=Object.assign({},DISC_DEF,{enabled:1});if(!all||!('frostline_ytCfg' in all))set.frostline_ytCfg={enabled:1,wfs:0,remember:1,shortcut:1};if(!all||!('frostline_dimmerCfg' in all))set.frostline_dimmerCfg={enabled:1,white:1,dark:0,vals:{dimmer:0,reader:0,blur:0},fx:{dimmer:1,reader:0,blur:0},edit:'dimmer',mode:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}};if(Object.keys(set).length)chrome.storage.local.set(set);}catch{}});}}catch{}dimApplyAll().catch(()=>{});theaterApplyAll().catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>{try{chrome.alarms.create('frostline-discard',{periodInMinutes:1});}catch{}setupDiscardMenus();dimApplyAll().catch(()=>{});theaterApplyAll().catch(()=>{});});
async function workerCompletePomo(){try{const o=await chrome.storage.local.get('frostline_pomo');const p=o&&o.frostline_pomo;if(!p||!p.running||!p.endAt)return;const done={base:p.base||0,running:false,endAt:0,left:0};await chrome.storage.local.set({frostline_pomo:done});try{chrome.runtime.sendMessage({cmd:'pomo-beep'});}catch{}try{chrome.notifications.create({type:'basic',title:'Focus session complete',message:'Pomodorodinha timer finished - nice work!',iconUrl:chrome.runtime.getURL('assets/icon128.png'),silent:false});}catch{}}catch{}}
chrome.alarms.onAlarm.addListener(a=>{if(!a)return;if(a.name==='frostline-discard'){autoDiscard();return;}if(a.name==='pomo-end'){workerCompletePomo();return;}});
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{if(msg&&msg.cmd==='pomo-start'){const _en=+msg.endAt||0;if(_en){try{chrome.alarms.create('pomo-end',{when:_en});}catch{}}try{sendResponse({ok:true});}catch{}return true;}if(msg&&msg.cmd==='pomo-stop'){try{chrome.alarms.clear('pomo-end');}catch{}try{sendResponse({ok:true});}catch{}return true;}if(msg&&msg.cmd==='discard-now'){autoDiscard().then(r=>{try{sendResponse(r||{discarded:0});}catch{}});return true;}if(msg&&msg.cmd==='dim-apply'){dimApplyAll().then(r=>{try{sendResponse(r||{ok:false,applied:0,failed:0});}catch{}});return true;}if(msg&&msg.cmd==='shade-status'){dimVerifyAll().then(r=>{try{sendResponse(r||{mismatch:false,tabs:0});}catch{}});return true;}if(msg&&msg.cmd==='shade-reset'){dimResetAll().then(r=>{try{sendResponse(r||{ok:false,reset:0});}catch{}});return true;}if(msg&&msg.cmd==='theater-status'){theaterVerifyAll().then(r=>{try{sendResponse(r||{mismatch:false,tabs:0});}catch{}});return true;}if(msg&&msg.cmd==='theater-reset'){theaterResetAll().then(r=>{try{sendResponse(r||{ok:false,reset:0});}catch{}});return true;}if(msg&&msg.cmd==='theater-apply'){theaterApplyAll().then(r=>{try{sendResponse(r||{ok:false,applied:0,failed:0});}catch{}});return true;}if(msg&&msg.cmd==='theater-btn'){try{(async()=>{try{const cur=await theaterCfg();const pt=(msg&&msg.patch)||{};const upd={};if(typeof pt.wfs!=='undefined')upd.wfs=pt.wfs?1:0;const next=Object.assign({},cur,upd);await chrome.storage.local.set({frostline_ytCfg:next});if(msg.vid&&cur.remember){try{const mem=await theaterMem();mem[msg.vid]={wfs:next.wfs?1:0};await theaterMemSave(mem);}catch{}}try{sendResponse({ok:true});}catch{}}catch{try{sendResponse({ok:false});}catch{}}})();}catch{try{sendResponse({ok:false});}catch{}}return true;}});
chrome.contextMenus.onClicked.addListener((info,tab)=>{const id=String((info&&info.menuItemId)||'');if(id==='frostline-disc-release'){releaseTabs(tab||null);return;}if(id.indexOf('frostline-disc-')===0)manualDiscard(id.slice('frostline-disc-'.length),tab||null);});
chrome.commands.onCommand.addListener(async cmd=>{
  try{
    const o=await chrome.storage.local.get('frostline_dimmerCfg');
    const cfg=Object.assign({enabled:0,intensity:40,white:1,dark:0,fx:{dimmer:1},vals:{dimmer:0,reader:0,blur:0},edit:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}},o.frostline_dimmerCfg||{});
    if(cmd==='toggle-theater'){try{const t=await theaterCfg();if(!t.shortcut)return;await chrome.storage.local.set({frostline_ytCfg:Object.assign({},t,{enabled:t.enabled?0:1})});await theaterApplyAll();}catch{}return;}
    if(cmd==='toggle-dimmer')cfg.enabled=cfg.enabled?0:1;
    else if(cmd==='dimmer-up')cfg.intensity=Math.min(100,(+cfg.intensity||0)+10);
    else if(cmd==='dimmer-down')cfg.intensity=Math.max(0,(+cfg.intensity||0)-10);
    else return;
    await chrome.storage.local.set({frostline_dimmerCfg:cfg});
    await dimApplyAll();
  }catch{}
});
