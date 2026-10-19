// Frostline new tab wallpaper bootstrap. Loaded from <head> so the cached
// wallpaper is the very first paint: app.js runs at the end of body and, on
// Every New Tab, only reaches loadBackground after the Unsplash round trip, so
// the layer used to sit on the stylesheet placeholder until then.
// Reads localStorage directly because the stylesheet cannot, and a blocking
// script in <head> runs before the body is parsed.
(function () {
  try {
    var bg = localStorage.getItem('frostline_bg');
    if (bg !== null && JSON.parse(bg) !== 'unsplash') return;
    var cache = JSON.parse(localStorage.getItem('frostline_bgCache') || 'null');
    if (!cache || typeof cache.url !== 'string') return;
    // localStorage is user-writable, so only paint URLs this extension produced.
    if (cache.url.indexOf('https://images.unsplash.com/') !== 0) return;
    // JSON.stringify yields a CSS-valid quoted string and escapes any quote.
    document.documentElement.style.setProperty('--bg-boot', 'url(' + JSON.stringify(cache.url) + ')');
  } catch (e) {}
})();