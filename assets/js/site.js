(() => {
  'use strict';
  const root = document.documentElement;
  const english = root.lang === 'en';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const embedded = (() => { try { return window.self !== window.top || new URLSearchParams(location.search).has('embed'); } catch { return true; } })();
  if (embedded) {
    root.classList.add('is-embed');
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href="/"]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      try { window.parent.postMessage({ type: 'close-site-modal' }, location.origin); } catch {}
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        try { window.parent.postMessage({ type: 'close-site-modal' }, location.origin); } catch {}
      }
    });
  }
  root.classList.add('js');
  document.querySelectorAll('[data-skill-fill]').forEach(el => {
    const label = document.querySelector('[data-field="skill-' + el.dataset.skillFill + '"]');
    const value = Number(label?.textContent.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
    el.style.width = (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0) + '%';
    const track = el.closest('[role="progressbar"]'); if (track && Number.isFinite(value)) track.setAttribute('aria-valuenow', String(Math.round(value)));
  });

  const themeKey = 'portfolio-theme-v2';
  try { localStorage.removeItem('portfolio-theme'); } catch {}
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const applyTheme = (theme, save) => {
    root.dataset.theme = theme;
    if (metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#f8f6f2' : '#12121d');
    if (save) { try { localStorage.setItem(themeKey, theme); } catch {} }
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const dark = theme === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', english ? 'Dark theme' : 'Koyu tema');
      button.title = english ? (dark ? 'Switch to light theme' : 'Switch to dark theme') : (dark ? 'Açık temaya geç' : 'Koyu temaya geç');
    });
  };
  let stored = null;
  try { stored = localStorage.getItem(themeKey); } catch {}
  applyTheme(stored === 'light' ? 'light' : 'dark', false);

  document.querySelectorAll('[data-theme-toggle]').forEach(button =>
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      if (!reduced.matches && typeof document.startViewTransition === 'function') {
        const rect = button.getBoundingClientRect();
        root.style.setProperty('--theme-x', `${(rect.left + rect.width / 2).toFixed(1)}px`);
        root.style.setProperty('--theme-y', `${(rect.top + rect.height / 2).toFixed(1)}px`);
        try {
          const vt = document.startViewTransition(() => applyTheme(next, true));
          vt?.ready?.catch(() => {});
          vt?.finished?.catch(() => {});
        } catch {
          applyTheme(next, true);
        }
      } else {
        applyTheme(next, true);
      }
    }));

  addEventListener('storage', event => { if (event.key === themeKey) applyTheme(event.newValue === 'light' ? 'light' : 'dark', false); });
  if (embedded) {
    addEventListener('message', event => {
      if (event.origin !== location.origin) return;
      if (event.data && event.data.type === 'set-site-theme') applyTheme(event.data.theme === 'light' ? 'light' : 'dark', false);
    });
  }

  const menu = document.querySelector('[data-menu]');
  const nav = document.querySelector('.navlinks');
  if (menu && nav) {
    const mobile = matchMedia('(max-width: 1100px)');
    const setMenu = open => {
      nav.classList.toggle('open', open);
      menu.setAttribute('aria-expanded', String(open));
      nav.inert = mobile.matches && !open;
    };
    menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', event => { if (event.target.closest('a') && mobile.matches) setMenu(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && mobile.matches && nav.classList.contains('open')) { setMenu(false); menu.focus(); }
    });
    document.addEventListener('click', event => {
      if (mobile.matches && !nav.contains(event.target) && !menu.contains(event.target)) setMenu(false);
    });
    mobile.addEventListener('change', () => setMenu(false)); setMenu(false);
  }

  document.querySelector('[data-contact-form]')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('button[type="submit"]'), status = document.querySelector('#form-status');
    const data = Object.fromEntries(new FormData(form));
    if (data.website) return; // bot tuzağı
    const fallbackMailto = () => {
      const to = (document.querySelector('[data-contact-link="email"] [data-field]')?.textContent || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { status.textContent = english ? 'Email address is unavailable.' : 'E-posta adresi bulunamadı.'; return; }
      const clean = v => String(v || '').replace(/[\r\n]+/g, ' ').trim();
      const body = (english ? 'Name: ' : 'Ad soyad: ') + clean(data.name) + '\n' + (english ? 'Email: ' : 'E-posta: ') + clean(data.email) + '\n\n' + String(data.message || '').trim();
      location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(clean(data.subject)) + '&body=' + encodeURIComponent(body);
      status.textContent = english ? 'Your email app is opening with the message ready. Press send there to finish.' : 'E-posta uygulaman mesaj hazır şekilde açılıyor. Göndermek için oradaki Gönder düğmesine bas.';
    };
    if (location.protocol === 'file:') { fallbackMailto(); return; }
    if (button) button.disabled = true;
    status.textContent = english ? 'Sending message…' : 'Mesaj gönderiliyor…';
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) { fallbackMailto(); return; }
      const j = await r.json();
      if (!r.ok) { status.textContent = j.error || (english ? 'Could not send message.' : 'Mesaj gönderilemedi.'); return; }
      form.reset();
      status.textContent = english ? 'Message sent! Thank you, I will reply soon.' : 'Mesajın iletildi! Teşekkürler, en kısa sürede dönüş yapacağım.';
    } catch {
      fallbackMailto();
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.querySelectorAll('.bio-copy').forEach(copy => {
    const paragraphs = copy.textContent.split(/\n\s*\n/).filter(text => text.trim());
    copy.replaceChildren(...paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text.trim(); return p; }));
  });
  document.querySelectorAll('[data-contact-link]').forEach(link => {
    const value = link.querySelector('[data-field]')?.textContent.trim() || '';
    link.href = link.dataset.contactLink === 'email' ? 'mailto:' + value : 'tel:' + value.replace(/[^+\d]/g, '');
  });
})();

// A dependency-free command menu: navigation stays native, including new tabs.
// Note: Kömür is intentionally excluded from Ctrl+K per owner preference.
(() => {
  const script = document.currentScript;
  const base = new URL('../../', script.src);
  const en = document.documentElement.lang === 'en';
  const nav = document.querySelector('.navlinks');
  if (!nav || !HTMLDialogElement.prototype.showModal) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('../css/command.css?v=20261123', script.src); document.head.append(css);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'command-launch'; button.textContent = '⌘';
  button.setAttribute('aria-label', en ? 'Quick navigation (Ctrl+K)' : 'Hızlı gezinme (Ctrl+K)');
  button.setAttribute('aria-haspopup', 'dialog'); button.title = en ? 'Quick navigation · Ctrl+K' : 'Hızlı gezinme · Ctrl+K';
  nav.insertBefore(button, nav.querySelector('.lang'));
  const dialog = document.createElement('dialog'); dialog.className = 'command-dialog';
  dialog.setAttribute('aria-label', en ? 'Quick navigation' : 'Hızlı gezinme');
  dialog.innerHTML = '<div class="command-search"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false"><button type="button" class="command-close">ESC</button></div><div class="command-results"></div><p class="command-hint"></p>';
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  input.setAttribute('aria-label', en ? 'Search pages and actions' : 'Sayfa ve işlem ara');
  input.placeholder = en ? 'Where would you like to go?' : 'Nereye gitmek istersin?';
  dialog.querySelector('.command-close').setAttribute('aria-label', en ? 'Close' : 'Kapat');
  dialog.querySelector('.command-hint').textContent = en ? '↑ ↓ navigate   ↵ open   esc close' : '↑ ↓ gezin   ↵ aç   esc kapat';
  const names = en ? ['Home', 'About', 'Projects', 'Journal', 'Gallery', 'Contact'] : ['Anasayfa', 'Hakkımda', 'Projeler', 'Blog', 'Galeri', 'İletişim'];
  const files = en ? ['en/index.html', 'en/about.html', 'en/projects.html', 'en/blog.html', 'en/gallery.html', 'en/contact.html'] : ['anasayfa.html', 'hakkimda.html', 'projeler.html', 'blog.html', 'galeri.html', 'iletisim.html'];
  const entries = names.map((name, i) => ({ name, file: files[i], hint: String(i + 1).padStart(2, '0') }));
  entries.push({ name: en ? '3D world' : '3D dünya', file: '/3d', hint: '3D' });
  let selected = 0, opener;
  const results = dialog.querySelector('.command-results');
  function select(index) {
    const nodes = [...results.querySelectorAll('.command-result')];
    selected = nodes.length ? (index + nodes.length) % nodes.length : 0;
    nodes.forEach((node, i) => node.classList.toggle('is-selected', i === selected));
    nodes[selected]?.scrollIntoView({ block: 'nearest' });
  }
  function render() {
    results.replaceChildren();
    const query = input.value.toLocaleLowerCase(en ? 'en' : 'tr').trim();
    entries.filter(entry => entry.name.toLocaleLowerCase(en ? 'en' : 'tr').includes(query)).forEach(entry => {
      const node = document.createElement(entry.theme ? 'button' : 'a'); node.className = 'command-result';
      if (entry.theme) { node.type = 'button'; node.addEventListener('click', () => { document.querySelector('[data-theme-toggle]')?.click(); dialog.close(); }); }
      else node.href = new URL(entry.file, base).href;
      const label = document.createElement('span'); label.textContent = entry.name;
      const hint = document.createElement('small'); hint.textContent = entry.hint;
      node.append(label, hint); results.append(node);
    });
    if (!results.children.length) { const empty = document.createElement('p'); empty.className = 'command-empty'; empty.textContent = en ? 'No matches. Try another word.' : 'Sonuç bulunamadı. Başka bir kelime dene.'; results.append(empty); }
    select(0);
  }
  function open() { if (dialog.open) return; opener = document.activeElement; input.value = ''; render(); dialog.showModal(); input.focus(); }
  button.addEventListener('click', open);
  input.addEventListener('input', render);
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); select(selected + (event.key === 'ArrowDown' ? 1 : -1)); }
    if (event.key === 'Enter') { event.preventDefault(); results.querySelectorAll('.command-result')[selected]?.click(); }
  });
  dialog.querySelector('.command-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); } }, true);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus());
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); dialog.open ? dialog.close() : open(); } });

  const english = document.documentElement.lang === 'en';
  const consentKey = 'portfolio-consent';
  let consent = null;
  try { consent = localStorage.getItem(consentKey); } catch {}
  window.__consent = { choice: consent, analytics: consent === 'all' };
  const inEmbed = document.documentElement.classList.contains('is-embed');
  if (!inEmbed && consent !== 'all' && consent !== 'essential') {
    const box = document.createElement('section');
    box.className = 'consent';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', english ? 'Privacy notice' : 'Gizlilik bildirimi');
    box.innerHTML = '<p>' + (english
      ? 'This site only uses essential local storage (theme and language choice, admin panel session). There are no tracking or advertising cookies. Fonts load from Google Fonts.'
      : "Bu site yalnız zorunlu yerel depolama kullanır (tema/dil tercihi, yönetim paneli oturumu). Takip veya reklam çerezi yoktur. Yazı tipleri Google Fonts’tan yüklenir.") + '</p>' +
      '<div class="consent-actions"><button type="button" class="btn" data-consent="all">' + (english ? 'Accept' : 'Kabul et') +
      '</button><button type="button" class="btn ghost" data-consent="essential">' + (english ? 'Essential only' : 'Yalnız zorunlu') + '</button></div>';
    box.addEventListener('click', event => {
      const b = event.target.closest('[data-consent]');
      if (!b) return;
      const choice = b.dataset.consent;
      try { localStorage.setItem(consentKey, choice); } catch {}
      window.__consent = { choice, analytics: choice === 'all' };
      box.classList.add('is-leaving');
      setTimeout(() => box.remove(), 220);
    });
    document.body.append(box);
  }
})();
