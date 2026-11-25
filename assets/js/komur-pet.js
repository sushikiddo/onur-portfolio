/* Kömür — sitede gezen yardımcı kedi.
   Çizimler Kömür 2.4.0'ın kendi CatRenderer'ından üretildi (assets/komur/frames.js). */
(function () {
  'use strict';
  if (window.__komurPet || window.self !== window.top) return; // admin önizlemesi (iframe) içinde açılmaz
  window.__komurPet = true;

  var script = document.currentScript;
  var base = new URL('../komur/', script ? script.src : location.href);
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    sget: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };

  var T = EN ? {
    hello: "Hi, I'm Kömür! 🐾 Welcome to Onur's portfolio.",
    helloTip: 'Click me any time and I will show you around.',
    label: 'Kömür the cat — open the help menu',
    menuTitle: 'Where shall we go?',
    projects: 'Projects', about: 'About Onur', contact: 'Contact', komur: 'Download me', top: 'Back to top',
    meow: 'Meow!', hide: 'Hide me', show: 'Bring Kömür back', close: 'Close',
    petted: ['Purr… 💛', 'Mrrr? 😺', 'Thanks for the pets!'],
    sleepy: 'Zzz… click to wake me up.',
    tips: {
      index: 'Scroll down to see the projects, or use the menu at the top.',
      about: "Here you can read who Onur is and which tools he uses.",
      projects: "Open 'Process and outcome' on a card to see how a project was made.",
      komur: 'This is my page! 😺 You can download me to your own computer here.',
      blog: 'Pick a post to read it.',
      gallery: "Onur's design and photo work is in this gallery.",
      contact: 'Fill in the form to leave Onur a message.',
      detail: 'This is a project page. Go back to Projects to see the others.'
    }
  } : {
    hello: 'Merhaba, ben Kömür! 🐾 Onur’un portfolyo sitesine hoş geldin.',
    helloTip: 'İstediğin zaman bana tıkla, sana yol göstereyim.',
    label: 'Kömür kedi — yardım menüsünü aç',
    menuTitle: 'Nereye gidelim?',
    projects: 'Projeler', about: 'Onur hakkında', contact: 'İletişim', komur: 'Beni indir', top: 'Yukarı çık',
    meow: 'Miyav!', hide: 'Beni gizle', show: 'Kömür’ü geri getir', close: 'Kapat',
    petted: ['Mırr… 💛', 'Mrrr? 😺', 'Sevdiğin için teşekkürler!'],
    sleepy: 'Zzz… uyandırmak için tıkla.',
    tips: {
      index: 'Projeleri görmek için aşağı kaydır ya da üstteki menüyü kullan.',
      about: 'Burada Onur’un kim olduğunu ve hangi araçları kullandığını okuyabilirsin.',
      projects: 'Kartlardaki “Süreç ve sonuç” kısmını açarsan projenin nasıl yapıldığını görürsün.',
      komur: 'Burası benim sayfam! 😺 Beni buradan kendi bilgisayarına indirebilirsin.',
      blog: 'Okumak istediğin yazıya tıkla.',
      gallery: 'Onur’un tasarım ve fotoğraf çalışmaları bu galeride.',
      contact: 'Onur’a mesaj bırakmak için formu doldurabilirsin.',
      detail: 'Bu bir proje sayfası. Diğerlerini görmek için Projeler’e dönebilirsin.'
    }
  };
  var LINKS = EN
    ? { projects: 'projects.html', about: 'about.html', contact: 'contact.html', komur: 'komur.html' }
    : { projects: 'projeler.html', about: 'hakkimda.html', contact: 'iletisim.html', komur: 'komur.html' };

  function pageKey() {
    var f = location.pathname.split('/').pop() || 'index.html';
    var map = {
      'index.html': 'index', 'anasayfa.html': 'index', 'hakkimda.html': 'about', 'about.html': 'about',
      'projeler.html': 'projects', 'projects.html': 'projects', 'komur.html': 'komur', 'blog.html': 'blog',
      'galeri.html': 'gallery', 'gallery.html': 'gallery', 'iletisim.html': 'contact', 'contact.html': 'contact'
    };
    return map[f] || 'detail';
  }

  /* ---------- styles ---------- */
  var css = [
    '.kp{position:fixed;left:0;bottom:0;z-index:80;width:var(--kp-w);height:calc(var(--kp-w)*1.077);pointer-events:none;will-change:transform;transition:bottom .4s ease}',
    '.kp-cat{position:absolute;inset:0;padding:0;border:0;background:none;cursor:pointer;pointer-events:auto;border-radius:40%;-webkit-tap-highlight-color:transparent}',
    '.kp-cat:focus-visible{outline:2px solid var(--accent,#f59e42);outline-offset:2px}',
    '.kp canvas{width:100%;height:100%;display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,.28))}',
    'html[data-theme=dark] .kp canvas{filter:drop-shadow(0 0 1.5px rgba(255,255,255,.55)) drop-shadow(0 0 10px rgba(255,255,255,.12))}',
    '.kp-bubble{position:absolute;bottom:calc(100% - 6px);left:50%;width:max-content;max-width:min(260px,calc(100vw - 24px));padding:10px 13px;border-radius:14px;',
    'background:var(--paper-2,#191a2a);color:var(--ink,#f4f3f8);border:1px solid var(--line-strong,rgba(255,255,255,.2));box-shadow:0 10px 30px -12px rgba(0,0,0,.55);',
    'font:500 14px/1.4 "Plus Jakarta Sans",system-ui,sans-serif;pointer-events:auto;opacity:0;transform:translateX(var(--kp-bx,-50%));transition:opacity .2s,visibility .2s;visibility:hidden}',
    '.kp-bubble.on{opacity:1;visibility:visible}',
    '.kp-bubble p{margin:0}.kp-bubble p+p{margin-top:4px;color:var(--ink-2,#a5a7bc);font-size:13px}',
    '.kp-menu{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
    '.kp-menu a,.kp-menu button{display:block;padding:7px 9px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.1));background:transparent;color:inherit;font:inherit;font-size:13px;text-align:center;text-decoration:none;cursor:pointer}',
    '.kp-menu a:hover,.kp-menu button:hover,.kp-menu a:focus-visible,.kp-menu button:focus-visible{border-color:var(--accent,#f59e42);color:var(--accent,#f59e42);outline:none}',
    '.kp-x{position:absolute;top:4px;right:6px;border:0;background:none;color:var(--ink-2,#a5a7bc);font-size:16px;line-height:1;cursor:pointer;padding:2px 4px}',
    '.kp-back{position:fixed;left:12px;bottom:12px;z-index:80;width:40px;height:40px;border-radius:50%;border:1px solid var(--line-strong,rgba(255,255,255,.2));background:var(--paper-2,#191a2a);color:var(--ink,#f4f3f8);font-size:19px;cursor:pointer;box-shadow:0 6px 18px -8px rgba(0,0,0,.5)}',
    '@media print{.kp,.kp-back{display:none}}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- elements ---------- */
  var root = document.createElement('div');
  root.className = 'kp';
  root.setAttribute('data-komur-pet', '');
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kp-cat';
  btn.setAttribute('aria-label', T.label);
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  var canvas = document.createElement('canvas');
  btn.appendChild(canvas);
  var bubble = document.createElement('div');
  bubble.className = 'kp-bubble';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  root.appendChild(bubble);
  root.appendChild(btn);
  var back = document.createElement('button');
  back.type = 'button';
  back.className = 'kp-back';
  back.textContent = '🐾';
  back.title = T.show;
  back.setAttribute('aria-label', T.show);

  var ctx = canvas.getContext('2d');
  var size = 0, ground = 0;
  function measure() {
    size = innerWidth < 640 ? 78 : 112;
    root.style.setProperty('--kp-w', size + 'px');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * 1.077 * dpr);
    ground = size * (18 / 260); // feet sit at y=262 of the 280-tall frame
    root.style.marginBottom = -ground + 'px';
    x = Math.max(minX(), Math.min(x, maxX()));
  }

  /* ---------- frames ---------- */
  var data = null, cache = {};
  function frames(state) {
    if (!data || !data.states[state]) return null;
    if (!cache[state]) {
      cache[state] = data.states[state].map(function (svg) {
        var img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + data.w + ' ' + data.h + '" width="' + data.w + '" height="' + data.h + '">' + svg + '</svg>');
        return img;
      });
    }
    return cache[state];
  }
  var lastImg = null;
  function paint(state, idx, flip) {
    var list = frames(state);
    if (!list) return;
    var img = list[idx % list.length];
    if (!img.complete || !img.naturalWidth) img = lastImg;
    if (!img) return;
    lastImg = img;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (flip) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  /* ---------- sound (only from the Miyav! menu button) ---------- */
  var sounds = {};
  function play(name) {
    try {
      var a = sounds[name] || (sounds[name] = new Audio(new URL(name + '.mp3', base).href));
      a.volume = 0.45;
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  /* ---------- behaviour ---------- */
  var x = -200, facing = 1, state = 'sit', stateT = 0, stateDur = 4, target = null, walkDist = 0;
  var fps = 10, speed = 0, menuOpen = false, lastInteract = performance.now();
  function minX() { return 4; }
  function maxX() { return Math.max(minX(), innerWidth - size - 4); }
  // a walk loop covers 140 renderer units (70 u/s for 2 s) -> keep feet planted
  function loopPx() { return 140 * size / 260; }

  function setState(s, dur) {
    state = s;
    stateT = 0;
    stateDur = dur;
    frames(s);
  }
  function walkTo(tx) {
    target = Math.max(minX(), Math.min(tx, maxX()));
    facing = target >= x ? 1 : -1;
    speed = 70 * size / 260;
    setState('wander', 999);
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function nextAction() {
    if (menuOpen) return setState('sit', 3);
    var idle = (performance.now() - lastInteract) / 1000;
    if (idle > 75 && Math.random() < 0.5) return setState('sleep', rand(25, 45));
    var r = Math.random();
    if (!reduced && r < 0.42) {
      // stay near the page edges so content stays readable
      var w = maxX(), edge = Math.min(w * 0.28, 320);
      var tx = Math.random() < 0.5 ? rand(minX(), edge) : rand(w - edge, w);
      if (Math.abs(tx - x) < 60) tx = x < w / 2 ? rand(w - edge, w) : rand(minX(), edge);
      return walkTo(tx);
    }
    if (r < 0.62) return setState('sit', rand(4, 8));
    if (r < 0.74) return setState('look', 3);
    if (r < 0.84) return setState('groom', 3);
    if (r < 0.9) return setState('yawn', 2.5);
    if (r < 0.95) return setState('stretch', 2.5);
    return setState('roll', 3);
  }

  /* ---------- bubble ---------- */
  var bubbleTimer = 0;
  function placeBubble() {
    // keep the bubble inside the viewport
    var bw = bubble.offsetWidth, cx = x + size / 2;
    var left = Math.max(12, Math.min(cx - bw / 2, innerWidth - 12 - bw));
    root.style.setProperty('--kp-bx', (left - x - size / 2) + 'px');
    bubble.style.left = size / 2 + 'px';
  }
  function say(lines, ms) {
    menuOpen = false;
    btn.setAttribute('aria-expanded', 'false');
    bubble.innerHTML = '';
    [].concat(lines).forEach(function (l, i) {
      var p = document.createElement('p');
      p.textContent = l;
      bubble.appendChild(p);
    });
    bubble.classList.add('on');
    placeBubble();
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(hideBubble, ms);
  }
  function hideBubble() {
    clearTimeout(bubbleTimer);
    bubble.classList.remove('on');
    if (menuOpen) { menuOpen = false; btn.setAttribute('aria-expanded', 'false'); }
  }
  function openMenu() {
    menuOpen = true;
    btn.setAttribute('aria-expanded', 'true');
    clearTimeout(bubbleTimer);
    bubble.innerHTML = '';
    var x0 = document.createElement('button');
    x0.type = 'button'; x0.className = 'kp-x'; x0.textContent = '×'; x0.setAttribute('aria-label', T.close);
    x0.onclick = function () { hideBubble(); btn.focus(); };
    var p = document.createElement('p');
    p.textContent = T.menuTitle;
    var tip = document.createElement('p');
    tip.textContent = T.tips[pageKey()];
    var m = document.createElement('div');
    m.className = 'kp-menu';
    var cur = pageKey();
    [['projects', 'projects'], ['about', 'about'], ['contact', 'contact'], ['komur', 'komur']].forEach(function (k) {
      if (cur === k[1]) return;
      var a = document.createElement('a');
      a.href = LINKS[k[0]];
      a.textContent = T[k[0]];
      m.appendChild(a);
    });
    function action(label, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.onclick = fn;
      m.appendChild(b);
    }
    if (scrollY > 400) action(T.top, function () { hideBubble(); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });
    action(T.meow, function () { play('meow'); setState('play', 2); say(T.meow, 1800); });
    action(T.hide, function () { hideBubble(); setHidden(true); });
    bubble.appendChild(x0); bubble.appendChild(p); bubble.appendChild(tip); bubble.appendChild(m);
    bubble.classList.add('on');
    placeBubble();
  }

  var clicks = 0;
  btn.addEventListener('click', function () {
    lastInteract = performance.now();
    if (state === 'sleep') { setState('stretch', 2.5); say(EN ? 'Mrrp? I’m awake!' : 'Mrrp? Uyandım!', 2500); return; }
    if (menuOpen) { hideBubble(); return; }
    target = null;
    if (++clicks % 4 === 0) { setState('sit', 4); say(pick(T.petted), 2500); return; }
    setState('sit', 8);
    openMenu();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && bubble.classList.contains('on')) { hideBubble(); btn.focus(); } });
  document.addEventListener('pointerdown', function (e) { if (menuOpen && !root.contains(e.target)) hideBubble(); });
  back.addEventListener('click', function () { setHidden(false); say(T.hello, 4000); });

  var hidden = false;
  function setHidden(h) {
    hidden = h;
    store.set('komur-pet-hidden', h ? '1' : '');
    root.style.display = h ? 'none' : '';
    back.style.display = h ? '' : 'none';
    if (!h) { lastInteract = performance.now(); setState('sit', 4); start(); }
  }

  /* consent bar sits at the bottom centre: step above it while it is shown */
  function lift() {
    var c = document.querySelector('.consent');
    var h = c ? c.getBoundingClientRect() : null; // fixed elements have no offsetParent
    var overlap = h && h.height > 0 && getComputedStyle(c).visibility !== 'hidden' && x + size > h.left && x < h.right;
    root.style.bottom = overlap ? Math.round(innerHeight - h.top + 6) + 'px' : '0px';
  }

  /* ---------- loop ---------- */
  var prev = 0, frameClock = 0, liftClock = 0, running = false;
  function tick(now) {
    if (!running || hidden) { running = false; return; }
    var dt = Math.min(0.1, (now - (prev || now)) / 1000);
    prev = now;
    stateT += dt;
    frameClock += dt;
    if (state === 'wander' && target !== null) {
      var step = Math.min(Math.abs(target - x), speed * dt);
      x += step * facing;
      walkDist += step;
      if (Math.abs(target - x) < 0.5) { target = null; nextAction(); }
    } else if (stateT >= stateDur) {
      nextAction();
    }
    var list = data && data.states[state];
    var idx = 0;
    if (list) {
      idx = state === 'wander'
        ? Math.floor((walkDist / loopPx()) * list.length)
        : Math.floor(frameClock * fps);
    }
    root.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    paint(state, idx, facing < 0);
    if (bubble.classList.contains('on')) placeBubble();
    liftClock += dt;
    if (liftClock > 0.5) { liftClock = 0; lift(); }
    requestAnimationFrame(tick);
  }
  function start() {
    if (running || hidden || document.hidden) return;
    running = true; prev = 0;
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) running = false; else start();
  });

  /* ---------- boot ---------- */
  function boot() {
    document.body.appendChild(root);
    document.body.appendChild(back);
    back.style.display = 'none';
    measure();
    addEventListener('resize', measure);
    // frames ship as a script so the pet also works from file:// (offline copy of the site)
    new Promise(function (ok, fail) {
      if (window.KOMUR_FRAMES) return ok(window.KOMUR_FRAMES);
      var s = document.createElement('script');
      s.src = new URL('frames.js?v=242', base).href;
      s.onload = function () { window.KOMUR_FRAMES ? ok(window.KOMUR_FRAMES) : fail(); };
      s.onerror = fail;
      document.head.appendChild(s);
    }).then(function (d) {
      data = d;
      ['wander', 'sit'].forEach(frames);
      if (store.get('komur-pet-hidden') === '1') { setHidden(true); return; }
      var first = !store.sget('komur-pet-greeted');
      var key = 'komur-pet-tip-' + location.pathname;
      if (reduced) { x = minX(); setState('sit', 6); }
      else {
        // walk in from the left edge
        x = -size; walkTo(Math.min(maxX(), innerWidth < 640 ? 12 : 60));
      }
      start();
      if (first) {
        store.sset('komur-pet-greeted', '1');
        store.sset(key, '1');
        setTimeout(function () { say([T.hello, T.helloTip], 8000); }, reduced ? 300 : 1800);
      } else if (!store.sget(key)) {
        store.sset(key, '1');
        setTimeout(function () { if (!menuOpen) say(T.tips[pageKey()], 6000); }, reduced ? 300 : 2200);
      }
    }).catch(function () { root.remove(); back.remove(); });
  }
  var go = function () { (window.requestIdleCallback || setTimeout)(boot, { timeout: 1500 }); };
  if (document.readyState === 'complete') go(); else addEventListener('load', go);
})();
