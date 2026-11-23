(() => {
  'use strict';
  const root = document.documentElement;
  const self = document.currentScript;
  const asset = rel => new URL(rel, self.src).href;
  const motionStyles = document.createElement('link');
  motionStyles.rel = 'stylesheet';
  motionStyles.href = asset('../css/motion.css?v=20261123');
  document.head.append(motionStyles);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const main = document.querySelector('main');
  const header = document.querySelector('.top');
  const isEn = root.lang === 'en';
  const hero = document.querySelector('.cinematic-hero');
  const body = document.body;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const wide = () => !reduced.matches && innerWidth >= 768;

  const SPLIT_SEL = '.pagehead h1,.pagehead .lead,.section-heading h2,.section-heading p,.home-intro .lead,.hero-copy h1,.hero-tagline,.bio-copy,.footer-signature,.notes-section blockquote p';
  if (!reduced.matches && 'IntersectionObserver' in window) root.classList.add('split-pending');

  // ---- Scroll progress hairline -----------------------------------------------------------------------------
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  body.append(progressBar);

  // ---- Shared state + single rAF loop (Lenis, scroll progress, parallax) ------------------------------------
  const pf = window.__pf = { lenis: null, scroll: scrollY, progress: 0, tasks: [], add(fn) { this.tasks.push(fn); } };

  let docMax = 1;
  const measureDoc = () => { docMax = Math.max(1, root.scrollHeight - innerHeight); };
  measureDoc();
  if ('ResizeObserver' in window) new ResizeObserver(measureDoc).observe(body);
  addEventListener('resize', measureDoc, { passive: true });

  function updateProgress() {
    const sc = pf.lenis ? pf.lenis.scroll : scrollY;
    pf.scroll = sc;
    pf.progress = clamp(sc / docMax);
    progressBar.style.transform = `scaleX(${pf.progress.toFixed(4)})`;
    header?.classList.toggle('is-scrolled', sc > 8);
  }

  function smoothScroll() {
    if (!wide()) {
      let ticking = false;
      addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; updateProgress(); }); }
      }, { passive: true });
      updateProgress();
      return;
    }
    const nav = document.querySelector('.navlinks');
    let locked = false;
    const loop = t => {
      requestAnimationFrame(loop);
      const lenis = pf.lenis;
      if (lenis) {
        const lock = !!((nav && nav.classList.contains('open')) || document.querySelector('dialog[open]'));
        if (lock !== locked) { locked = lock; lock ? lenis.stop() : lenis.start(); }
        lenis.raf(t);
      }
      updateProgress();
      for (const fn of pf.tasks) { try { fn(t); } catch {} }
    };
    requestAnimationFrame(loop);

    const s = document.createElement('script');
    s.src = asset('../vendor/lenis.min.js');
    s.async = true;
    s.onload = () => {
      try {
        if (typeof Lenis !== 'function' || reduced.matches) return;
        pf.lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false, autoRaf: false });
        root.classList.add('pf-lenis');
        reduced.addEventListener('change', () => {
          if (reduced.matches && pf.lenis) { pf.lenis.destroy(); pf.lenis = null; root.classList.remove('pf-lenis'); }
        });
      } catch { pf.lenis = null; }
    };
    document.head.append(s);

    document.addEventListener('click', event => {
      const link = event.target.closest('a[href*="#"]');
      if (!link || !pf.lenis || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, document.baseURI);
      if (url.origin !== location.origin || url.pathname !== location.pathname) return;
      const dest = url.hash.length > 1 ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
      if (url.hash.length > 1 && !dest) return;
      event.preventDefault();
      pf.lenis.scrollTo(dest || 0, { offset: dest ? -48 : 0 });
      try { history.replaceState(null, '', url.hash || location.pathname); } catch {}
      if (dest) dest.focus?.({ preventScroll: true });
    });
  }

  // ---- Sleek session preloader (first home view per session) ------------------------------------------------
  function preloader() {
    return new Promise(resolve => {
      let el = null;
      const done = () => { try { el && el.remove(); } catch {} resolve(); };
      try {
        if (!hero || reduced.matches || root.classList.contains('is-embed')) return resolve();
        if (sessionStorage.getItem('pf-preloaded')) return resolve();
        sessionStorage.setItem('pf-preloaded', '1');
        el = document.createElement('div');
        el.className = 'preloader';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML =
          '<span class="preloader-brand">Onur Can Orhan</span>' +
          '<span class="preloader-bar"><i class="preloader-bar-fill"></i></span>' +
          '<span class="preloader-meta"><span>' + (isEn ? 'LOADING' : 'YÜKLENİYOR') + '</span><span class="preloader-count">00</span></span>';
        body.append(el);
        const count = el.querySelector('.preloader-count');
        const fill = el.querySelector('.preloader-bar-fill');
        const start = performance.now();
        let loaded = document.readyState === 'complete';
        if (!loaded) addEventListener('load', () => { loaded = true; }, { once: true });
        const MIN = 220, MAX = 900, RAMP = 360;
        const tick = now => {
          try {
            const t = now - start;
            const finish = (t >= MIN && loaded) || t >= MAX;
            const p = Math.min(1, t / RAMP);
            const eased = finish ? 1 : (1 - Math.pow(1 - p, 3)) * 0.96;
            const val = finish ? 100 : Math.min(99, Math.round(eased * 100));
            count.textContent = String(val).padStart(2, '0');
            fill.style.transform = `scaleX(${eased.toFixed(3)})`;
            if (!finish) return requestAnimationFrame(tick);
            el.classList.add('is-leaving');
            setTimeout(done, 580);
            setTimeout(resolve, 200);
          } catch { done(); }
        };
        requestAnimationFrame(tick);
        setTimeout(done, MAX + 1200);
      } catch { done(); }
    });
  }
  const preloaded = preloader();

  // ---- Line-by-line text reveal -----------------------------------------------------------------------------
  const INLINE = /^(EM|STRONG|A|ABBR|CODE|SPAN|BR|B|I|SMALL|MARK|SUB|SUP|TIME|U|S|CITE|Q)$/;
  const FORM = 'input,textarea,select,button,form,[contenteditable]';
  const splitState = new WeakMap();
  let splitIO = null;

  const inlineOnly = el => ![...el.querySelectorAll('*')].some(n => !INLINE.test(n.tagName));
  function collectSplit() {
    const out = [];
    const visit = el => {
      if (el.matches(FORM) || el.querySelector(FORM) || !el.textContent.trim()) return;
      if (inlineOnly(el)) out.push(el); else [...el.children].forEach(visit);
    };
    const all = [...document.querySelectorAll(SPLIT_SEL)];
    all.filter(el => !all.some(o => o !== el && el.contains(o))).forEach(visit);
    return [...new Set(out)];
  }

  function splitLines(el) {
    const st = splitState.get(el);
    if (!st) splitState.set(el, { html: el.innerHTML, revealed: false }); else el.innerHTML = st.html;
    const words = [];
    const walk = (node, chain) => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const s = document.createElement('span');
          s.textContent = part;
          words.push({ s, chain });
          frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n, [...chain, n]);
    });
    walk(el, []);
    if (!words.length) return;
    const lines = [];
    let top = null, h = 0;
    words.forEach(w => {
      const r = w.s.getBoundingClientRect();
      if (top === null || r.top > top + Math.max(h, 8) * 0.6) { lines.push([]); top = r.top; h = r.height; }
      lines.at(-1).push(w);
    });
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

  const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight * 0.98; };

  function runSplit() {
    if (reduced.matches || !('IntersectionObserver' in window)) { root.classList.remove('split-pending'); return; }
    const process = () => {
      collectSplit().forEach(el => {
        if (el.querySelector(':scope > .split-line')) return;
        const was = splitState.get(el);
        try { splitLines(el); } catch { return; }
        if (!splitIO) return;
        if (was && was.revealed) el.classList.add('is-in');
        else if (onScreen(el)) {
          const st = splitState.get(el); if (st) st.revealed = true;
          setTimeout(() => el.classList.add('is-in'), 30);
        } else splitIO.observe(el);
      });
      root.classList.remove('split-pending');
    };
    const openGate = () => {
      splitIO = new IntersectionObserver(es => es.forEach(e => {
        if (!(e.intersectionRatio >= 0.15 || e.intersectionRect.height >= innerHeight * 0.15)) return;
        splitIO.unobserve(e.target);
        const st = splitState.get(e.target);
        if (st) st.revealed = true;
        requestAnimationFrame(() => e.target.classList.add('is-in'));
      }), { threshold: [0, 0.15, 0.5] });
      process();
      const sweep = () => document.querySelectorAll('.split-ready:not(.is-in)').forEach(el => { if (onScreen(el)) el.classList.add('is-in'); });
      setTimeout(sweep, 320); setTimeout(sweep, 1400);
      document.addEventListener('visibilitychange', sweep);
      let timer = 0;
      new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(process, 160); })
        .observe(main || body, { childList: true, subtree: true, characterData: true });
    };
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(r => setTimeout(r, 280))])
      .then(() => preloaded)
      .then(openGate)
      .catch(() => root.classList.remove('split-pending'));
    setTimeout(() => root.classList.remove('split-pending'), 1400);

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

  // ---- Staggered scroll reveals + media clip-path unveil ----------------------------------------------------
  function initScrollReveals() {
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    const targets = [...document.querySelectorAll(
      '.card,.focus-card,.panel,.education-grid,.komur-panel,.process-list li,.journal-index a,.schedule-scroll,.notes-section pre,.notes-section blockquote'
    )];
    if (!targets.length) return;

    const groups = new Map();
    targets.forEach(el => {
      const parent = el.parentElement || body;
      const idx = groups.get(parent) || 0;
      groups.set(parent, idx + 1);
      el.style.setProperty('--reveal-delay', `${Math.min(idx % 4, 3) * 75}ms`);
      el.classList.add('reveal-ready');
      if (el.querySelector('.visual')) el.classList.add('media-reveal');
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        if (el.classList.contains('media-reveal')) el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });

    preloaded.then(() => {
      targets.forEach(el => {
        if (onScreen(el)) {
          requestAnimationFrame(() => {
            el.classList.add('is-visible');
            if (el.classList.contains('media-reveal')) el.classList.add('is-in');
          });
        } else {
          io.observe(el);
        }
      });
      setTimeout(() => {
        targets.forEach(el => {
          if (onScreen(el)) {
            el.classList.add('is-visible');
            if (el.classList.contains('media-reveal')) el.classList.add('is-in');
          }
        });
      }, 1100);
    });
  }

  // ---- Gentle GPU vertical parallax on [data-parallax] media ------------------------------------------------
  function initParallax() {
    if (!wide()) return;
    const items = [...document.querySelectorAll('[data-parallax] img')];
    if (!items.length) return;
    pf.add(() => {
      const vh = innerHeight || 1;
      for (const img of items) {
        const box = img.parentElement.getBoundingClientRect();
        if (box.bottom < -60 || box.top > vh + 60) continue;
        const ratio = ((box.top + box.height * 0.5) / vh) - 0.5;
        const offset = Math.max(-14, Math.min(14, ratio * -24));
        img.style.translate = `0 ${offset.toFixed(1)}px`;
      }
    });
  }

  // ---- Cursor-tracking specular spotlight on cards & panels -------------------------------------------------
  function initSpotlight() {
    if (reduced.matches || !finePointer.matches) return;
    let activeCard = null;
    document.addEventListener('pointermove', event => {
      const card = event.target.closest('.card,.focus-card,.komur-panel');
      if (!card) { activeCard = null; return; }
      activeCard = card;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${(event.clientX - rect.left).toFixed(1)}px`);
      card.style.setProperty('--my', `${(event.clientY - rect.top).toFixed(1)}px`);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { activeCard = null; }, { passive: true });
  }

  // ---- Sliding glass hover pill on desktop nav --------------------------------------------------------------
  function initNavPill() {
    const nav = document.querySelector('.navlinks');
    if (!nav || reduced.matches || !finePointer.matches) return;
    const links = [...nav.querySelectorAll(':scope > a:not(.world-link):not(.lang)')];
    if (!links.length) return;
    const pill = document.createElement('span');
    pill.className = 'nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    nav.prepend(pill);

    const moveTo = link => {
      const nr = nav.getBoundingClientRect();
      const lr = link.getBoundingClientRect();
      pill.style.width = `${lr.width.toFixed(1)}px`;
      pill.style.transform = `translate3d(${(lr.left - nr.left).toFixed(1)}px,-50%,0)`;
      pill.classList.add('is-active');
    };
    links.forEach(link => {
      link.addEventListener('mouseenter', () => moveTo(link));
      link.addEventListener('focus', () => moveTo(link));
    });
    nav.addEventListener('mouseleave', () => pill.classList.remove('is-active'));
    nav.addEventListener('focusout', e => { if (!nav.contains(e.relatedTarget)) pill.classList.remove('is-active'); });
  }

  // ---- Subtle magnetic pull on hero primary button ----------------------------------------------------------
  function initMagnetic() {
    if (reduced.matches || !finePointer.matches) return;
    document.querySelectorAll('.hero-copy .actions .btn:not(.ghost)').forEach(btn => {
      btn.addEventListener('pointermove', event => {
        const r = btn.getBoundingClientRect();
        const dx = ((event.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 5;
        const dy = ((event.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 4;
        btn.style.transform = `translate3d(${dx.toFixed(1)}px,${(dy - 2).toFixed(1)}px,0)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  // ---- Hero entrance choreography (eyebrow + lead + actions) ------------------------------------------------
  preloaded.then(() => {
    if (reduced.matches) return;
    const status = document.querySelector('.hero-status');
    if (status && status.animate) {
      status.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 540, delay: 40, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
      );
    }
    const lead = document.querySelector('.hero-copy .lead');
    if (lead && lead.animate) {
      lead.animate(
        [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: 640, delay: 240, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
      );
    }
    document.querySelectorAll('.hero-copy .actions .btn').forEach((b, i) => b.animate &&
      b.animate(
        [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: 600, delay: 360 + i * 90, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
      ));
  });

  [smoothScroll, runSplit, initScrollReveals, initParallax, initSpotlight, initNavPill, initMagnetic].forEach(fn => {
    try { fn(); } catch (e) { console.warn('[pf]', fn.name, e); }
  });

  // ---- Architectural page transition curtain ----------------------------------------------------------------
  const curtain = document.createElement('div');
  curtain.className = 'page-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  body.append(curtain);

  if (!reduced.matches && !root.classList.contains('is-embed')) {
    const cameFromSite = sessionStorage.getItem('pf-navigating') === '1';
    sessionStorage.removeItem('pf-navigating');
    if (cameFromSite) {
      curtain.classList.add('curtain-enter');
      setTimeout(() => curtain.classList.remove('curtain-enter'), 520);
    }
    main?.classList.add('page-enter');
  }
  main?.addEventListener('animationend', event => { if (event.target === main) main.classList.remove('page-enter'); });

  let navigating = false;
  addEventListener('pageshow', () => {
    root.classList.remove('page-leaving');
    curtain.classList.remove('curtain-exit', 'curtain-enter');
    navigating = false;
  });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, document.baseURI);
    if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.origin !== location.origin || url.protocol !== location.protocol) return;
    if (!url.pathname.endsWith('.html') || url.pathname === location.pathname || /\/admin/i.test(url.pathname)) return;
    if (navigating) { event.preventDefault(); return; }
    event.preventDefault();
    navigating = true;
    try { sessionStorage.setItem('pf-navigating', '1'); } catch {}
    main?.classList.remove('page-enter');
    curtain.classList.remove('curtain-enter');
    curtain.classList.add('curtain-exit');
    setTimeout(() => { location.href = url.href; }, 320);
  });
})();
