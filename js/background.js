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
async function dimCfg(){try{const o=await chrome.storage.local.get('frostline_dimmerCfg');return Object.assign({enabled:0,intensity:40,white:1,dark:0,fx:{dimmer:1},vals:{dimmer:45,reader:75,blur:50},edit:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}},o.frostline_dimmerCfg||{});}catch{return{enabled:0,intensity:40,white:1,dark:0,fx:{dimmer:1},vals:{dimmer:45,reader:75,blur:50},edit:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}};}}
const dimCssCache=new Map();
function dimCss(cfg,boost){
  const V=(k,fb)=>{const v=cfg.vals&&cfg.vals[k];return Math.min(100,Math.max(0,(typeof v==='number'?v:fb)))/100;};
  const SC=k=>(((cfg.scopes||{})[k])==='media'?'media':'page');
  const FX=cfg.fx||{dimmer:1,reader:1,blur:1};
  const vd=FX.dimmer?V('dimmer',45):0, vr=FX.reader?V('reader',75):0, vb=FX.blur?V('blur',50):0;
  const gate=(boost||0);
  let css='';
  if(cfg.dark)css+='html.frostline-darkdm{filter:invert(1) hue-rotate(180deg)!important;background:#111!important}html.frostline-darkdm img,html.frostline-darkdm video,html.frostline-darkdm canvas,html.frostline-darkdm picture{filter:invert(1) hue-rotate(180deg)!important}';
  const mD=SC('dimmer')==='media'?vd:0, mR=SC('reader')==='media'?vr:0, mB=SC('blur')==='media'?vb:0;
  if(mD>0||mR>0||mB>0){
    const tot=Math.min(1,mD+mR+mB*0.25+((mD>0||mR>0)?gate:0));
    let f='brightness('+Math.max(.15,1-tot*.85).toFixed(3)+')';
    if(mR>0)f+=' sepia('+(mR*0.6).toFixed(2)+')';
    if(mB>0)f+=' blur('+(mB*20).toFixed(1)+'px)';
    css+='img,video,canvas,picture,[style*="background-image"]{filter:'+f+'!important;transition:filter 150ms ease!important}';
  }
  const layers=[];
  if(SC('reader')==='page'&&vr>0){const wa=Math.min(0.4,vr*0.45);layers.push('linear-gradient(rgba(255,196,130,'+wa.toFixed(3)+'),rgba(255,196,130,'+wa.toFixed(3)+'))');}
  const pbrad=SC('blur')==='page'?vb*20:0;
  const pveil=SC('blur')==='page'?vb*0.25:0;
  const pvd=SC('dimmer')==='page'?vd:0;
  const ba=Math.min(1,pvd+pveil+(((SC('dimmer')==='page'&&pvd>0)||(SC('reader')==='page'&&vr>0))?gate:0));
  if(ba>0)layers.push('linear-gradient(rgba(0,0,0,'+ba.toFixed(3)+'),rgba(0,0,0,'+ba.toFixed(3)+'))');
  if(layers.length||pbrad>0){
    css+='html::after{content:""!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;background:'+(layers.length?layers.join(','):'transparent')+'!important;margin:0!important;padding:0!important;border:0!important;transition:opacity 150ms ease,backdrop-filter 150ms ease!important;backdrop-filter:blur('+pbrad.toFixed(1)+'px)!important;-webkit-backdrop-filter:blur('+pbrad.toFixed(1)+'px)!important}';
  }
  css+='@media print{html.frostline-ov::after{display:none!important}}';
  return{css};
}
async function dimApply(tabId,cfg){
  try{
    if(!cfg.enabled){
      try{await chrome.scripting.executeScript({target:{tabId:tabId},func:()=>{try{var o=document.getElementById('frostline-dimmer-ov');if(o)o.remove();document.documentElement.classList.remove('frostline-darkdm','frostline-monly');}catch(e){}}});}catch{}
      const old=dimCssCache.get(tabId);
      if(old){try{await chrome.scripting.removeCSS({target:{tabId:tabId},css:old});}catch{}dimCssCache.delete(tabId);}
      try{await chrome.scripting.insertCSS({target:{tabId:tabId},css:'html::after{display:none!important}img,video,canvas,picture,[style*="background-image"]{filter:none!important}'});}catch{}
      return{ok:true};
    }
    let boost=0;
    if(cfg.white){try{const r=await chrome.scripting.executeScript({target:{tabId:tabId},func:()=>{try{var bg=getComputedStyle(document.body).backgroundColor||'';var m=bg.match(/[\d.]+/g);return(m&&m.length>=3)?((.299*m[0]+.587*m[1]+.114*m[2])/255):0;}catch(e){return 0;}}});const L=r&&r[0]&&r[0].result;if(typeof L==='number'&&L>.82)boost=.15;}catch{}}
    await chrome.scripting.executeScript({target:{tabId:tabId},func:(mode,dark)=>{try{var ov=document.getElementById('frostline-dimmer-ov');if(ov)ov.remove();}catch(e){}try{
      document.documentElement.classList.toggle('frostline-darkdm',!!dark);
      document.documentElement.classList.add('frostline-ov');
    }catch(e){}},args:[cfg.mode,!!cfg.dark]});
    const built=dimCss(cfg,boost);
    // Always replace rather than trusting the cache. insertCSS is bound to the
    // document, and YouTube's SPA navigation plus every full reload discards it
    // while our Map still holds the old string - so the guard would skip the
    // re-insert and Shade silently stopped applying until the worker restarted.
    const old=dimCssCache.get(tabId);
    if(old){try{await chrome.scripting.removeCSS({target:{tabId:tabId},css:old});}catch{}dimCssCache.delete(tabId);}
    try{await chrome.scripting.insertCSS({target:{tabId:tabId},css:built.css});dimCssCache.set(tabId,built.css);}
    catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}
    return{ok:true};
  }catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}
}
async function dimApplyAll(){const cfg=await dimCfg();let tabs=[];try{tabs=await chrome.tabs.query({});}catch{return{ok:false};}
  let n=0,f=0,lastErr='';
  for(const t of tabs){if(!/^https?:\/\//i.test(t.url||''))continue;if(t.discarded)continue;try{const r=await dimApply(t.id,cfg);if(r&&r.ok)n++;else{f++;if(r&&r.err)lastErr=r.err;}}catch(e){f++;lastErr=String((e&&e.message)||e).slice(0,140);}}
  try{await chrome.storage.local.set({frostline_dimStatus:{ts:Date.now(),tabs:tabs.length,applied:n,failed:f,lastErr}});}catch{}
  return{ok:true,applied:n,failed:f};
}
// Frostline Theater engine (YouTube: windowed fullscreen)
const TH_DEF={enabled:0,wfs:1,remember:1,shortcut:1};
async function theaterCfg(){try{const o=await chrome.storage.local.get('frostline_ytCfg');return Object.assign({},TH_DEF,o.frostline_ytCfg||{});}catch{return Object.assign({},TH_DEF);}}
function theaterVid(url){try{const u=new URL(url||'');const h=(u.hostname||'').toLowerCase();if(h.includes('youtube.com')){if(u.pathname==='/watch')return u.searchParams.get('v')||'';if(u.pathname.indexOf('/shorts/')===0)return u.pathname.split('/')[2]||'';return '';}if(h==='youtu.be'||h.endsWith('.youtu.be'))return (u.pathname||'').replace(/^\//,'').split('/')[0]||'';return '';}catch{return '';}}
function theaterIsYT(url){return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/)/i.test(url||'');}
async function theaterMem(){try{const o=await chrome.storage.local.get('frostline_theaterMem');return (o&&o.frostline_theaterMem)||{};}catch{return {};}}
async function theaterMemSave(mem){try{await chrome.storage.local.set({frostline_theaterMem:mem||{}});}catch{}}
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
  if(cfg.wfs)css+='html.frostline-th-wfs #masthead-container,html.frostline-th-wfs #secondary,html.frostline-th-wfs ytd-comments,html.frostline-th-wfs #below{display:none!important}html.frostline-th-wfs #primary,html.frostline-th-wfs #player-container-outer,html.frostline-th-wfs ytd-watch-flexy{width:100vw!important;max-width:100vw!important}html.frostline-th-wfs #movie_player{width:100vw!important;height:100vh!important;position:fixed!important;top:0!important;left:0!important;z-index:2147483647!important}html.frostline-th-wfs #content{padding-top:0!important}';
  css+=FROSTLINE_TIP_CSS;
  return{css};
}
const theaterCssCache=new Map();
function frostlineTheaterBoot(cfg){
  try{
    var wfs=!!cfg.wfs;
    var de=document.documentElement;
    try{var tb=document.querySelector('.ytp-size-button');var th2=document.querySelector('ytd-watch-flexy[theater]');if(wfs&&tb&&!th2&&tb.click)tb.click();}catch(_){}
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
        if(ex0&&ex0.isConnected&&ex0.dataset.frostlineBv==='7'){paintB();return true;}
        if(ex0){try{ex0.remove();}catch(_){}}
        var sx0=document.getElementById('frostline-th-str');if(sx0){try{sx0.remove();}catch(_){}}
        var bar=visBar();
        if(!bar)return false;
        var mk=function(id,title,svg){var b=document.createElement('button');b.className='ytp-button frostline-th-btn';b.id=id;b.dataset.frostlineBv='7';b.title=title;b.setAttribute('aria-label',title);b.setAttribute('role','switch');b.setAttribute('aria-checked','false');b.innerHTML=svg;return b;};
        var svgW='<svg height="24" viewBox="0 0 24 24" width="24"><path d="M3 3h6v2H5v4H3V3zm18 0h-6v2h4v4h2V3zM3 21h6v-2H5v-4H3v6zm18 0h-6v-2h4v-4h2v6z" fill="white"/></svg>';
        var bw=mk('frostline-th-wfs','Windowed fullscreen (`)',svgW);
        bw.onclick=function(e){e.preventDefault();e.stopPropagation();wfs=!wfs;try{var tb=document.querySelector('.ytp-size-button');var th2=document.querySelector('ytd-watch-flexy[theater]');if(wfs&&tb&&!th2&&tb.click)tb.click();}catch(_){}de.classList.toggle('frostline-th-wfs',wfs);rs();setTimeout(rs,300);paintB();save({wfs:wfs?1:0});};
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
          if(cur&&cur.isConnected&&cur.dataset.frostlineBv==='7')return;
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
      const old=theaterCssCache.get(tabId);
      if(old){try{await chrome.scripting.removeCSS({target:{tabId:tabId},css:old});}catch{}theaterCssCache.delete(tabId);}
      return{ok:true,skipped:true};
    }
    let eff=Object.assign({},cfg);
    const vid=theaterVid(url||'');
    if(cfg.remember&&vid){
      try{
        const mem=await theaterMem();
        if(mem&&mem[vid]){eff.wfs=mem[vid].wfs?1:0;}
      }catch{}
    }
    if(!eff.enabled){
      try{await chrome.scripting.executeScript({target:{tabId:tabId},func:frostlineTheaterOff});}catch{}
      const old2=theaterCssCache.get(tabId);
      if(old2){try{await chrome.scripting.removeCSS({target:{tabId:tabId},css:old2});}catch{}theaterCssCache.delete(tabId);}
      return{ok:true};
    }
    const built=theaterCss(eff);
    const old3=theaterCssCache.get(tabId);
    if(old3&&old3!==built.css){try{await chrome.scripting.removeCSS({target:{tabId:tabId},css:old3});}catch{}}
    if(!old3||old3!==built.css){try{await chrome.scripting.insertCSS({target:{tabId:tabId},css:built.css});}catch(e){return{ok:false,err:String((e&&e.message)||e).slice(0,140)};}theaterCssCache.set(tabId,built.css);}
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
  return{ok:true,applied:n,failed:f};
}
chrome.tabs.onActivated.addListener(async info=>{try{const id=info&&info.tabId;if(!id)return;const dc=await dimCfg();if(dc.enabled||dimCssCache.get(id))await dimApply(id,dc);let url='';try{const g=await chrome.tabs.get(id);url=g.url||'';}catch{}const tc=await theaterCfg();if(tc.enabled||theaterCssCache.has(id))await theaterApply(id,tc,url);}catch{}});
chrome.tabs.onUpdated.addListener((id,info,tab)=>{if(info&&info.status==='complete'){dimCfg().then(cfg=>dimApply(id,cfg));(async()=>{try{let url=(tab&&tab.url)||'';if(!url){try{const g=await chrome.tabs.get(id);url=g.url||'';}catch{}}const c=await theaterCfg();await theaterApply(id,c,url);}catch{}})();}});
function setupDiscardMenus(){try{const contexts=['page'];if(chrome.contextMenus.ContextType&&chrome.contextMenus.ContextType.TAB)contexts.unshift('tab');chrome.contextMenus.removeAll(()=>{
  chrome.contextMenus.create({id:'frostline-disc',title:'Discard Tabs',contexts});
  [['this','Discard this tab'],['right','Discard tabs to the right'],['left','Discard tabs to the left'],['others','Discard all other tabs'],['release','Release all tabs']].forEach(([id,title])=>chrome.contextMenus.create({id:'frostline-disc-'+id,parentId:'frostline-disc',title,contexts}));
});}catch{}}
chrome.runtime.onInstalled.addListener(details=>{try{chrome.alarms.create('frostline-discard',{periodInMinutes:1});}catch{}setupDiscardMenus();try{if(details&&details.reason==='install'&&chrome.storage&&chrome.storage.local){chrome.storage.local.get(null,all=>{try{const set={};if(!all||!('frostline_discardCfg' in all))set.frostline_discardCfg=Object.assign({},DISC_DEF,{enabled:1});if(!all||!('frostline_ytCfg' in all))set.frostline_ytCfg={enabled:1,wfs:1,remember:1,shortcut:1};if(!all||!('frostline_dimmerCfg' in all))set.frostline_dimmerCfg={enabled:1,white:1,dark:0,vals:{dimmer:0,reader:0,blur:0},fx:{dimmer:1,reader:0,blur:0},edit:'dimmer',mode:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}};if(Object.keys(set).length)chrome.storage.local.set(set);}catch{}});}}catch{}dimApplyAll().catch(()=>{});theaterApplyAll().catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>{try{chrome.alarms.create('frostline-discard',{periodInMinutes:1});}catch{}setupDiscardMenus();dimApplyAll().catch(()=>{});theaterApplyAll().catch(()=>{});});
async function workerCompletePomo(){try{const o=await chrome.storage.local.get('frostline_pomo');const p=o&&o.frostline_pomo;if(!p||!p.running||!p.endAt)return;const done={base:p.base||0,running:false,endAt:0,left:0};await chrome.storage.local.set({frostline_pomo:done});try{chrome.runtime.sendMessage({cmd:'pomo-beep'});}catch{}try{chrome.notifications.create({type:'basic',title:'Focus session complete',message:'Pomodorodinha timer finished — nice work!',iconUrl:chrome.runtime.getURL('assets/icon128.png'),silent:false});}catch{}}catch{}}
chrome.alarms.onAlarm.addListener(a=>{if(!a)return;if(a.name==='frostline-discard'){autoDiscard();return;}if(a.name==='pomo-end'){workerCompletePomo();return;}});
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{if(msg&&msg.cmd==='pomo-start'){const _en=+msg.endAt||0;if(_en){try{chrome.alarms.create('pomo-end',{when:_en});}catch{}}try{sendResponse({ok:true});}catch{}return true;}if(msg&&msg.cmd==='pomo-stop'){try{chrome.alarms.clear('pomo-end');}catch{}try{sendResponse({ok:true});}catch{}return true;}if(msg&&msg.cmd==='discard-now'){autoDiscard().then(r=>{try{sendResponse(r||{discarded:0});}catch{}});return true;}if(msg&&msg.cmd==='dim-apply'){dimApplyAll().then(r=>{try{sendResponse(r||{ok:false,applied:0,failed:0});}catch{}});return true;}if(msg&&msg.cmd==='theater-apply'){theaterApplyAll().then(r=>{try{sendResponse(r||{ok:false,applied:0,failed:0});}catch{}});return true;}if(msg&&msg.cmd==='theater-btn'){try{(async()=>{try{const cur=await theaterCfg();const pt=(msg&&msg.patch)||{};const upd={};if(typeof pt.wfs!=='undefined')upd.wfs=pt.wfs?1:0;const next=Object.assign({},cur,upd);await chrome.storage.local.set({frostline_ytCfg:next});if(msg.vid&&cur.remember){try{const mem=await theaterMem();mem[msg.vid]={wfs:next.wfs?1:0};await theaterMemSave(mem);}catch{}}try{sendResponse({ok:true});}catch{}}catch{try{sendResponse({ok:false});}catch{}}})();}catch{try{sendResponse({ok:false});}catch{}}return true;}});
chrome.contextMenus.onClicked.addListener((info,tab)=>{const id=String((info&&info.menuItemId)||'');if(id==='frostline-disc-release'){releaseTabs(tab||null);return;}if(id.indexOf('frostline-disc-')===0)manualDiscard(id.slice('frostline-disc-'.length),tab||null);});
chrome.commands.onCommand.addListener(async cmd=>{
  try{
    const o=await chrome.storage.local.get('frostline_dimmerCfg');
    const cfg=Object.assign({enabled:0,intensity:40,white:1,dark:0,fx:{dimmer:1},vals:{dimmer:45,reader:75,blur:50},edit:'dimmer',scopes:{dimmer:'page',reader:'page',blur:'page'}},o.frostline_dimmerCfg||{});
    if(cmd==='toggle-theater'){try{const t=await theaterCfg();if(!t.shortcut)return;await chrome.storage.local.set({frostline_ytCfg:Object.assign({},t,{enabled:t.enabled?0:1})});await theaterApplyAll();}catch{}return;}
    if(cmd==='toggle-dimmer')cfg.enabled=cfg.enabled?0:1;
    else if(cmd==='dimmer-up')cfg.intensity=Math.min(100,(+cfg.intensity||0)+10);
    else if(cmd==='dimmer-down')cfg.intensity=Math.max(0,(+cfg.intensity||0)-10);
    else return;
    await chrome.storage.local.set({frostline_dimmerCfg:cfg});
    await dimApplyAll();
  }catch{}
});
