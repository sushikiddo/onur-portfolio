(() => {
  'use strict';
  const root = document.documentElement;
  const english = root.lang === 'en';
  root.classList.add('js');
  document.querySelectorAll('[data-skill-fill]').forEach(el => {
    const label = document.querySelector('[data-field="skill-' + el.dataset.skillFill + '"]');
    const value = Number(label?.textContent.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
    el.style.width = (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0) + '%';
  });
  const themeKey = 'portfolio-theme';
  try { root.dataset.theme = localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'; }
  catch { root.dataset.theme = 'dark'; }
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    const update = () => {
      button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
      button.setAttribute('aria-label', english ? 'Dark theme' : 'Koyu tema');
    };
    button.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(themeKey, root.dataset.theme); } catch {}
      update();
    });
    update();
  });
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
    const form=event.currentTarget, button=form.querySelector('button[type="submit"]'), status=document.querySelector('#form-status');
    if(button.disabled)return;
    button.disabled=true; status.textContent=english?'Sending…':'Gönderiliyor…';
    try {
      const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form))),signal:AbortSignal.timeout(20000)});
      const data=await response.json();
      if(!response.ok)throw Error(english?'Unable to send. Please check the fields or try again later.':data.error||'Mesaj gönderilemedi.');
      form.reset();status.textContent=english?'Your message was sent successfully. Thank you!':'Mesajın başarıyla gönderildi. Teşekkürler!';
    }catch(error){status.textContent=english?'Unable to send. Please try again.':error.name==='TimeoutError'?'Bağlantı zaman aşımına uğradı. Lütfen tekrar dene.':'Mesaj gönderilemedi. '+error.message;}
    finally{button.disabled=false;}
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
(() => {
  const script = document.currentScript;
  const base = new URL('../../', script.src);
  const en = document.documentElement.lang === 'en';
  const nav = document.querySelector('.navlinks');
  if (!nav || !HTMLDialogElement.prototype.showModal) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('../css/command.css', script.src); document.head.append(css);
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
  const names = en ? ['Home','About','Projects','Journal','Gallery','Contact'] : ['Anasayfa','Hakkımda','Projeler','Blog','Galeri','İletişim'];
  const files = en ? ['en/index.html','en/about.html','en/projects.html','en/blog.html','en/gallery.html','en/contact.html'] : ['index.html','hakkimda.html','projeler.html','blog.html','galeri.html','iletisim.html'];
  const entries = names.map((name,i) => ({name, file:files[i], hint:String(i+1).padStart(2,'0')}));
  entries.push({name:en?'Play Space Survivor':'Space Survivor oyna',file:'oyun/index.html',hint:en?'GAME':'OYUN'});
  entries.push({name:en?'Switch theme':'Temayı değiştir',theme:true,hint:en?'ACTION':'İŞLEM'});
  let selected = 0, opener;
  const results = dialog.querySelector('.command-results');
  function select(index) {
    const nodes = [...results.querySelectorAll('.command-result')];
    selected = nodes.length ? (index + nodes.length) % nodes.length : 0;
    nodes.forEach((node,i) => node.classList.toggle('is-selected',i===selected));
    nodes[selected]?.scrollIntoView({block:'nearest'});
  }
  function render() {
    results.replaceChildren();
    const query = input.value.toLocaleLowerCase(en?'en':'tr').trim();
    entries.filter(entry => entry.name.toLocaleLowerCase(en?'en':'tr').includes(query)).forEach(entry => {
      const node = document.createElement(entry.theme?'button':'a'); node.className='command-result';
      if(entry.theme) { node.type='button'; node.addEventListener('click',()=>{document.querySelector('[data-theme-toggle]')?.click();dialog.close()}); }
      else node.href = new URL(entry.file,base).href;
      const label=document.createElement('span'); label.textContent=entry.name;
      const hint=document.createElement('small'); hint.textContent=entry.hint;
      node.append(label,hint); results.append(node);
    });
    if (!results.children.length) { const empty=document.createElement('p');empty.className='command-empty';empty.textContent=en?'No matches. Try another word.':'Sonuç bulunamadı. Başka bir kelime dene.';results.append(empty); }
    select(0);
  }
  function open() { if(dialog.open)return;opener=document.activeElement;input.value='';render();dialog.showModal();input.focus(); }
  button.addEventListener('click',open);
  input.addEventListener('input',render);
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();select(selected+(event.key==='ArrowDown'?1:-1));}
    if(event.key==='Enter'){event.preventDefault();results.querySelectorAll('.command-result')[selected]?.click();}
  });
  dialog.querySelector('.command-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}},true);
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>opener?.focus());
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();dialog.open?dialog.close():open();}});
})();
