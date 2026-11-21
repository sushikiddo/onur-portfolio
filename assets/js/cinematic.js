(() => {
  'use strict';
  const root = document.documentElement;
  const self = document.currentScript; // null later, capture now
  const asset = rel => new URL(rel, self.src).href;
  const motionStyles = document.createElement('link');
  motionStyles.rel = 'stylesheet';
  motionStyles.href = asset('../css/motion.css?v=20261122');
  document.head.append(motionStyles);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const main = document.querySelector('main');
  const header = document.querySelector('.top');
  const isEn = root.lang === 'en';
  const hero = document.querySelector('.cinematic-hero');
  const body = document.body;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const wide = () => !reduced.matches && innerWidth >= 768;

  // Text blocks that get the line-by-line reveal (motion.css lists the same set for the pre-split hold).
  const SPLIT_SEL = '.pagehead h1,.pagehead .lead,.section-heading h2,.section-heading p,.home-intro .lead,.hero-copy h1,.hero-tagline,.bio-copy,.footer-signature,.notes-section blockquote p';
  if (!reduced.matches && 'IntersectionObserver' in window) root.classList.add('split-pending');

  // Theme (dark default, light on request) is set by the inline head script and site.js.

  // ---- Shared state + the ONE rAF loop (Lenis, WebGL layer) ---------------------------------------------
  const pf = window.__pf = {lenis: null, scroll: scrollY, progress: 0, tasks: [], add(fn) { this.tasks.push(fn); }};
  function smoothScroll() {
    if (!wide()) return;
    const nav = document.querySelector('.navlinks');
    let docMax = 1, locked = false;
    const measure = () => { docMax = Math.max(1, root.scrollHeight - innerHeight); };
    measure();
    new ResizeObserver(measure).observe(body);
    addEventListener('resize', measure);
    const loop = t => {
      requestAnimationFrame(loop);
      const lenis = pf.lenis;
      if (lenis) {
        const lock = !!((nav && nav.classList.contains('open')) || document.querySelector('dialog[open]'));
        if (lock !== locked) { locked = lock; lock ? lenis.stop() : lenis.start(); }
        lenis.raf(t);
      }
      pf.scroll = lenis ? lenis.scroll : scrollY;
      pf.progress = clamp(pf.scroll / docMax);
      for (const fn of pf.tasks) { try { fn(t); } catch {} }
    };
    requestAnimationFrame(loop);

    const s = document.createElement('script');
    s.src = asset('../vendor/lenis.min.js');
    s.async = true;
    s.onload = () => {
      try {
        if (typeof Lenis !== 'function' || reduced.matches) return;
        pf.lenis = new Lenis({lerp: .085, smoothWheel: true, syncTouch: false, autoRaf: false});
        root.classList.add('pf-lenis');
        reduced.addEventListener('change', () => { if (reduced.matches && pf.lenis) { pf.lenis.destroy(); pf.lenis = null; root.classList.remove('pf-lenis'); } });
      } catch { pf.lenis = null; }
    };
    document.head.append(s);

    // In-page anchors glide with Lenis.
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href*="#"]');
      if (!link || !pf.lenis || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, document.baseURI);
      if (url.origin !== location.origin || url.pathname !== location.pathname) return;
      const dest = url.hash.length > 1 ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
      if (url.hash.length > 1 && !dest) return;
      event.preventDefault();
      pf.lenis.scrollTo(dest || 0, {offset: dest ? -40 : 0});
      try { history.replaceState(null, '', url.hash || location.pathname); } catch {}
      if (dest) dest.focus?.({preventScroll: true});
    });
  }

  // The heavy WebGL dust layer was dropped: the ambient glow is pure CSS (body::before in style.css).

  // ---- Preloader: home, first view per session ---------------------------------------------------------------
  function preloader() {
    return new Promise(resolve => {
      let el = null;
      const done = () => { try { el && el.remove(); } catch {} resolve(); };
      try {
        if (!hero || reduced.matches) return resolve();
        if (sessionStorage.getItem('pf-preloaded')) return resolve();
        sessionStorage.setItem('pf-preloaded', '1');
        el = document.createElement('div');
        el.className = 'preloader';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="preloader-label">' + (isEn ? 'LOADING' : 'YÜKLENİYOR') + '</span>' +
          '<span class="preloader-mark"><i class="glow-ring"></i></span>' +
          '<span class="preloader-count">0</span>';
        body.append(el);
        const count = el.querySelector('.preloader-count');
        const start = performance.now();
        let loaded = document.readyState === 'complete';
        if (!loaded) addEventListener('load', () => { loaded = true; }, {once: true});
        const MIN = 0, MAX = 1200, RAMP = 300; // no forced minimum wait: lift as soon as the page has loaded
        const tick = now => {
          try {
            const t = now - start;
            const finish = (t >= MIN && loaded) || t >= MAX;
            const p = Math.min(1, t / RAMP);
            count.textContent = finish ? 100 : Math.min(99, Math.round((1 - Math.pow(1 - p, 3)) * 100));
            if (!finish) return requestAnimationFrame(tick);
            el.classList.add('is-leaving');
            setTimeout(done, 580);
            setTimeout(resolve, 250); // text rises as the sheet lifts
          } catch { done(); }
        };
        requestAnimationFrame(tick);
        setTimeout(done, MAX + 1500); // hard safety net
      } catch { done(); }
    });
  }
  const preloaded = preloader();

  // ---- Line-by-line text reveal -----------------------------------------------------------------------------
  const INLINE = /^(EM|STRONG|A|ABBR|CODE|SPAN|BR|B|I|SMALL|MARK|SUB|SUP|TIME|U|S|CITE|Q)$/;
  const FORM = 'input,textarea,select,button,form,[contenteditable]';
  const splitState = new WeakMap(); // el -> {html, revealed}
  let splitIO = null;

  const inlineOnly = el => ![...el.querySelectorAll('*')].some(n => !INLINE.test(n.tagName));
  function collectSplit() {
    const out = [];
    const visit = el => {
      if (el.matches(FORM) || el.querySelector(FORM) || !el.textContent.trim()) return;
      if (inlineOnly(el)) out.push(el); else [...el.children].forEach(visit);
    };
    const all = [...document.querySelectorAll(SPLIT_SEL)];
    // Innermost target only (.bio-copy holds <p> children that the recursion handles).
    all.filter(el => !all.some(o => o !== el && el.contains(o))).forEach(visit);
    return [...new Set(out)];
  }

  function splitLines(el) {
    const st = splitState.get(el);
    if (!st) splitState.set(el, {html: el.innerHTML, revealed: false}); else el.innerHTML = st.html;
    const words = [];
    const walk = (node, chain) => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const s = document.createElement('span');
          s.textContent = part;
          words.push({s, chain});
          frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n, [...chain, n]);
    });
    walk(el, []);
    if (!words.length) return;
    // Group words into visual lines by rendered top.
    const lines = [];
    let top = null, h = 0;
    words.forEach(w => {
      const r = w.s.getBoundingClientRect();
      if (top === null || r.top > top + Math.max(h, 8) * .6) { lines.push([]); top = r.top; h = r.height; }
      lines.at(-1).push(w);
    });
    // Rebuild: one clipped wrapper per line; inline ancestors (em, a, ...) are cloned so they can span lines.
    const seen = new Set();
    const frag = document.createDocumentFragment();
    lines.forEach((ws, i) => {
      const outer = document.createElement('span'), inner = document.createElement('span');
      outer.className = 'split-line';
      outer.style.setProperty('--i', i);
      outer.append(inner);
      let prev = [];
      const open = [inner];
      ws.forEach((w, k) => {
        if (k) open.at(-1).append(' ');
        let d = 0;
        while (d < prev.length && d < w.chain.length && prev[d] === w.chain[d]) d++;
        open.length = d + 1;
        for (let j = d; j < w.chain.length; j++) {
          const c = w.chain[j].cloneNode(false);
          if (seen.has(w.chain[j])) c.removeAttribute('id'); else seen.add(w.chain[j]);
          open.at(-1).append(c);
          open.push(c);
        }
        prev = w.chain;
        open.at(-1).append(w.s.firstChild);
      });
      frag.append(outer);
    });
    el.replaceChildren(frag);
    el.classList.add('split-ready');
  }

  const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight * .98; };
  function runSplit() {
    if (reduced.matches || !('IntersectionObserver' in window)) { root.classList.remove('split-pending'); return; }
    const process = () => {
      collectSplit().forEach(el => {
        if (el.querySelector(':scope > .split-line')) return;
        const was = splitState.get(el);
        try { splitLines(el); } catch (e) { console.warn('[pf] split', e); return; }
        if (!splitIO) return;
        if (was && was.revealed) el.classList.add('is-in');
        else if (onScreen(el)) { // first screen: reveal at once, no observer wait
          const st = splitState.get(el); if (st) st.revealed = true;
          setTimeout(() => el.classList.add('is-in'), 30);
        } else splitIO.observe(el);
      });
      root.classList.remove('split-pending');
    };
    const openGate = () => {
      splitIO = new IntersectionObserver(es => es.forEach(e => {
        if (!(e.intersectionRatio >= .2 || e.intersectionRect.height >= innerHeight * .2)) return;
        splitIO.unobserve(e.target);
        const st = splitState.get(e.target);
        if (st) st.revealed = true;
        setTimeout(() => e.target.classList.add('is-in'), 0);
      }), {threshold: [0, .2, .5]});
      process();
      // Safety net: never leave on-screen text hidden.
      const sweep = () => document.querySelectorAll('.split-ready:not(.is-in)').forEach(el => { if (onScreen(el)) el.classList.add('is-in'); });
      setTimeout(sweep, 300); setTimeout(sweep, 1500);
      document.addEventListener('visibilitychange', sweep);
      // Database-driven text can arrive late and wipe our lines: split again what lost them.
      let timer = 0;
      new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(process, 160); })
        .observe(main || body, {childList: true, subtree: true, characterData: true});
    };
    // Split once fonts are in (line breaks depend on them); reveal once the preloader sheet is lifting.
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(r => setTimeout(r, 300))])
      .then(() => preloaded)
      .then(openGate)
      .catch(() => root.classList.remove('split-pending'));
    setTimeout(() => root.classList.remove('split-pending'), 1500);
    // Re-split on resize (debounced), only for blocks that have not been revealed yet.
    let rt = 0, lastW = innerWidth;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (innerWidth === lastW) return;
        lastW = innerWidth;
        document.querySelectorAll('.split-ready:not(.is-in)').forEach(el => { try { splitLines(el); el.classList.add('split-ready'); } catch {} });
      }, 200);
    });
  }

  // Hero buttons rise after the headline lines.
  preloaded.then(() => {
    if (reduced.matches) return;
    document.querySelectorAll('.hero-copy .actions .btn').forEach((b, i) => b.animate &&
      b.animate([{opacity: 0, transform: 'translateY(22px)'}, {opacity: 1, transform: 'none'}],
        {duration: 600, delay: 500 + i * 90, easing: 'cubic-bezier(.2,.7,.1,1)', fill: 'backwards'}));
  });

  // The scroll cue and status pill are left out on purpose: the client found them template-like.
  [smoothScroll, runSplit].forEach(fn => { try { fn(); } catch (e) { console.warn('[pf]', fn.name, e); } });

  // ---- Page curtain: decorative sheet, never intercepts input -------------------------------------------------
  const curtain = document.createElement('div');
  curtain.className = 'page-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  body.append(curtain);
  if (!reduced.matches) { curtain.classList.add('curtain-enter'); setTimeout(() => curtain.classList.remove('curtain-enter'), 550); }
  let navigating = false;
  if (!reduced.matches) main?.classList.add('page-enter');
  main?.addEventListener('animationend', event => { if (event.target === main) main.classList.remove('page-enter'); });
  addEventListener('pageshow', () => { root.classList.remove('page-leaving'); curtain.classList.remove('curtain-exit'); navigating = false; });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, document.baseURI);
    if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.origin !== location.origin || url.protocol !== location.protocol) return;
    if (!url.pathname.endsWith('.html') || url.pathname === location.pathname || /\/admin/i.test(url.pathname)) return;
    if (navigating) { event.preventDefault(); return; }
    event.preventDefault();
    navigating = true;
    main?.classList.remove('page-enter');
    curtain.classList.remove('curtain-enter');
    curtain.classList.add('curtain-exit');
    setTimeout(() => { location.href = url.href; }, 300);
  });

  // Header gets a hairline once the page scrolls.
  let scrollFrame = 0;
  function updateScroll() {
    scrollFrame = 0;
    header?.classList.toggle('is-scrolled', scrollY > 8);
  }
  addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, {passive: true});
  updateScroll();
})();
