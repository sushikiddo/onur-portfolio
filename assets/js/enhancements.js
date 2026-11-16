(() => {
 'use strict';
 document.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const modal = [...document.querySelectorAll('dialog[open]')].at(-1); if (!modal) return;
  const controls = [...modal.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length && !el.closest('[inert]'));
  if (!controls.length) { event.preventDefault(); return; }
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
 });
 const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
 if (!reduced && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
   if (!entry.isIntersecting) return;
   const el = entry.target; el.style.setProperty('--skill-target', el.style.width || '0%'); el.classList.add('skill-animate'); observer.unobserve(el);
  }), {threshold:.25});
  document.querySelectorAll('[data-skill-fill]').forEach(el => observer.observe(el));
 }
 const images = [...document.querySelectorAll('.gallery .visual img')]; if (!images.length) return;
 const en = document.documentElement.lang === 'en';
 const dialog = document.createElement('dialog'); dialog.className = 'portfolio-lightbox';
 dialog.setAttribute('aria-label', en ? 'Gallery image' : 'Galeri görseli'); dialog.setAttribute('aria-describedby','lightbox-caption');
 dialog.innerHTML = '<div class="lightbox-toolbar"><span class="lightbox-counter" aria-live="polite"></span><button type="button" class="lightbox-close">×</button></div><div class="lightbox-stage"><button type="button" class="lightbox-prev">‹</button><img alt=""><button type="button" class="lightbox-next">›</button></div><p class="lightbox-caption" id="lightbox-caption"></p>';
 document.body.append(dialog);
 dialog.querySelector('.lightbox-close').setAttribute('aria-label',en?'Close':'Kapat');
 dialog.querySelector('.lightbox-prev').setAttribute('aria-label',en?'Previous image':'Önceki görsel');
 dialog.querySelector('.lightbox-next').setAttribute('aria-label',en?'Next image':'Sonraki görsel');
 let index=0,opener;
 const picture=dialog.querySelector('.lightbox-stage img'); picture.draggable=false;
 const show = i => {
  index=(i+images.length)%images.length; const source=images[index]; picture.src=source.currentSrc||source.src;picture.alt=source.alt;
  dialog.querySelector('.lightbox-counter').textContent=String(index+1).padStart(2,'0')+' / '+String(images.length).padStart(2,'0');
  dialog.querySelector('.lightbox-caption').textContent=source.closest('.card').querySelector('h3')?.textContent||source.alt;
 };
 images.forEach((img,i) => {
  const wrap=img.closest('.visual');wrap.classList.add('gallery-clickable');wrap.setAttribute('role','button');wrap.tabIndex=0;wrap.setAttribute('aria-haspopup','dialog');wrap.setAttribute('aria-label',(en?'Enlarge: ':'Büyüt: ')+img.alt);
  const open=()=>{opener=wrap;show(i);if(!dialog.open)dialog.showModal();dialog.querySelector('.lightbox-close').focus()};
  wrap.addEventListener('click',open);wrap.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
 });
 dialog.querySelector('.lightbox-close').addEventListener('click',()=>dialog.close());
 dialog.querySelector('.lightbox-prev').addEventListener('click',()=>show(index-1));dialog.querySelector('.lightbox-next').addEventListener('click',()=>show(index+1));
 dialog.addEventListener('close',()=>opener?.focus());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(index-1)}if(event.key==='ArrowRight'){event.preventDefault();show(index+1)}});
 let start;
 picture.addEventListener('pointerdown',event=>{start={x:event.clientX,y:event.clientY};picture.setPointerCapture(event.pointerId)});
 picture.addEventListener('pointerup',event=>{if(start){const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)show(index+(dx<0?1:-1));start=null}});
 picture.addEventListener('pointercancel',()=>{start=null});
})();
