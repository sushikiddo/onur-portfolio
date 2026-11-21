(() => {
  'use strict';
  const root = document.documentElement;
  const motionStyles = document.createElement('link');
  motionStyles.rel = 'stylesheet';
  motionStyles.href = new URL('../css/motion.css', document.currentScript.src).href;
  document.head.append(motionStyles);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const main = document.querySelector('main');
  const header = document.querySelector('.top');

  // Cream is the default look: only when the visitor never chose a theme.
  // site.js (runs earlier) falls back to dark; an explicit choice is left alone.
  try {
    if (localStorage.getItem('portfolio-theme') === null && root.dataset.theme !== 'light') {
      root.dataset.theme = 'light';
      document.querySelectorAll('[data-theme-toggle]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    }
  } catch { /* storage blocked: keep whatever site.js chose */ }

  // Reveals: section headings only. Everything else is visible immediately.
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const items = document.querySelectorAll('.section-heading,.home-intro .intro-heading');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), {threshold: .06, rootMargin: '0px 0px -24px'});
    items.forEach(item => { item.classList.add('reveal-ready'); observer.observe(item); });
    reduced.addEventListener('change', () => { if (reduced.matches) items.forEach(item => item.classList.add('is-visible')); });
  }

  // Hero entrance, once per load. Uses fill:'backwards' so nothing stays hidden.
  function heroEntrance() {
    const h1 = document.querySelector('.hero-copy h1');
    if (!h1 || reduced.matches || !h1.animate) return;
    // Wrap bare text nodes in spans; <br>, <em> and other elements are kept as-is.
    const parts = [];
    [...h1.childNodes].forEach(node => {
      if (node.nodeType === 3 && node.textContent.trim()) {
        const span = document.createElement('span');
        span.className = 'hero-line';
        node.replaceWith(span);
        span.append(node);
        parts.push(span);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        node.classList.add('hero-line');
        parts.push(node);
      }
    });
    const ease = 'cubic-bezier(.22,1,.36,1)';
    const rise = (el, delay, dur = 520) => el && el.animate(
      [{opacity: 0, transform: 'translateY(22px)'}, {opacity: 1, transform: 'none'}],
      {duration: dur, delay, easing: ease, fill: 'backwards'});
    parts.forEach((el, i) => rise(el, i * 110));
    const t = parts.length * 110;
    rise(document.querySelector('.hero-tagline'), t + 40, 460);
    document.querySelectorAll('.hero-copy .actions .btn').forEach((b, i) => rise(b, t + 140 + i * 70, 420));
    const photo = document.querySelector('.hero-world');
    if (photo) {
      photo.animate(
        // Relative to the CSS `rotate` tilt, so the print settles without a jump at the end.
        [{opacity: 0, transform: 'translateY(-36px) rotate(-2.5deg)'}, {opacity: 1, transform: 'none'}],
        {duration: 600, delay: 220, easing: ease, fill: 'backwards'});
    }
  }
  heroEntrance();

  // Page curtain: decorative sheet, never intercepts input.
  const curtain = document.createElement('div');
  curtain.className = 'page-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  document.body.append(curtain);
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
