(() => {
  'use strict';
  const english = document.documentElement.lang === 'en';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controls = document.querySelector('.project-filters');
  const cards = [...document.querySelectorAll('.phantom-tiles .card')];
  if (!controls || !cards.length) return;
  const category = card => card.querySelector('.project-category')?.textContent.trim() || '';
  const choices = controls.querySelector('.project-filter-options');
  const count = document.createElement('p');
  count.className = 'note project-count'; count.setAttribute('role', 'status'); controls.after(count);
  let active = null;
  for (const cat of new Set(cards.map(category).filter(Boolean))) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'project-filter';
    button.dataset.filter = cat; button.textContent = cat; button.setAttribute('aria-pressed', 'false'); choices.append(button);
  }
  function update(animate = false) {
    let visible = 0;
    for (const card of cards) {
      const hide = active !== null && category(card) !== active;
      card.hidden = hide;
      if (!hide) {
        if (animate && !reduced) {
          card.classList.remove('filter-enter');
          card.classList.add('is-visible', 'is-in');
          card.style.setProperty('--filter-delay', `${visible * 65}ms`);
          void card.offsetWidth;
          card.classList.add('filter-enter');
        }
        visible++;
      }
    }
    document.querySelector('.project-empty').hidden = visible !== 0;
    count.textContent = english ? `${visible} projects shown` : `${visible} proje gösteriliyor`;
    controls.querySelectorAll('button').forEach(button => {
      const selected = active === null ? button.dataset.filter === 'all' : button.dataset.filter === active;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }
  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    active = button.parentElement === controls ? null : button.dataset.filter;
    update(true);
  });
  update(false);

  const dialog = document.createElement('dialog'); dialog.className = 'project-dialog';
  dialog.setAttribute('aria-labelledby', 'project-dialog-title'); dialog.setAttribute('aria-describedby', 'project-dialog-description');
  const shell = document.createElement('div'); shell.className = 'project-dialog-content';
  const closer = document.createElement('button');
  closer.type = 'button'; closer.className = 'project-dialog-close'; closer.textContent = '×';
  closer.setAttribute('aria-label', english ? 'Close project details' : 'Proje detaylarını kapat'); closer.addEventListener('click', () => dialog.close());
  const picture = document.createElement('img'); picture.className = 'project-dialog-image'; picture.alt = '';
  const info = document.createElement('div'); info.className = 'project-dialog-info';
  const label = document.createElement('p'); label.className = 'eyebrow';
  const title = document.createElement('h2'); title.id = 'project-dialog-title';
  const description = document.createElement('p'); description.id = 'project-dialog-description';
  const process = document.createElement('div'); process.className = 'case-sections';
  const links = document.createElement('div'); links.className = 'actions';
  const gallery = document.createElement('div');
  info.append(label, title, description, process, gallery, links); shell.append(closer, picture, info); dialog.append(shell); document.body.append(dialog);
  let opener;
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  for (const card of cards) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn ghost project-details-button'; button.textContent = english ? 'View details' : 'Detayları gör';
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-label', button.textContent + ': ' + card.querySelector('h3').textContent);
    button.addEventListener('click', () => {
      opener = button;
      const source = card.querySelector('.visual img'); picture.hidden = !source;
      if (source) { picture.src = source.currentSrc || source.src; picture.alt = source.alt; }
      label.textContent = category(card); title.textContent = card.querySelector('h3').textContent;
      description.textContent = card.querySelector('[data-field*="-desc-"]')?.textContent || '';
      process.replaceChildren();
      card.querySelectorAll('.case-sections section').forEach(section => {
        const clone = section.cloneNode(true), heading = clone.querySelector('h4');
        const replacement = document.createElement('h3'); replacement.textContent = heading.textContent; heading.replaceWith(replacement); process.append(clone);
      });
      links.replaceChildren(); const demo = card.querySelector('a.project-open'); if (demo) links.append(demo.cloneNode(true));
      gallery.replaceChildren();
      const galleryTitle = document.createElement('h3'); galleryTitle.className = 'project-gallery-heading'; galleryTitle.textContent = english ? 'Project gallery' : 'Proje galerisi'; gallery.append(galleryTitle);
      const media = [...card.querySelectorAll('.project-gallery-source img')].filter(img => !img.getAttribute('src').includes('comparison-placeholder.svg'));
      if (media.length) { const grid = document.createElement('div'); grid.className = 'project-media-grid'; media.forEach(img => { const clone = img.cloneNode(); clone.loading = 'eager'; grid.append(clone); }); gallery.append(grid); }
      else { const note = document.createElement('p'); note.className = 'note'; note.textContent = english ? 'Additional project images have not been added yet.' : 'Ek proje görselleri henüz eklenmedi.'; gallery.append(note); }
      if (category(card).toLocaleLowerCase().includes('photoshop')) {
        const sourceComparison = document.querySelector('section [data-comparison]');
        if (sourceComparison) {
          const heading = document.createElement('h3'); heading.className = 'modal-compare-title'; heading.textContent = english ? 'Before / after' : 'Önce / sonra'; gallery.append(heading);
          const note = document.createElement('p'); note.dataset.comparisonNote = ''; note.className = 'note'; note.textContent = sourceComparison.parentElement.querySelector('[data-comparison-note]').textContent; gallery.append(note);
          const clone = sourceComparison.cloneNode(true); delete clone.dataset.compareInitialized;
          clone.querySelector('input').id = 'modal-compare-range'; clone.querySelector('input').setAttribute('aria-describedby', 'modal-compare-help'); clone.querySelector('label').htmlFor = 'modal-compare-range'; clone.querySelector('#compare-help').id = 'modal-compare-help';
          gallery.append(clone); window.initPortfolioComparison?.(clone);
        }
      }
      dialog.showModal(); dialog.scrollTop = 0; closer.focus();
    }); card.querySelector('.inner').append(button);
  }
})();

(() => {
  'use strict';
  const init = figure => {
    if (figure.dataset.compareInitialized) return;
    figure.dataset.compareInitialized = 'true';
    const english = document.documentElement.lang === 'en';
    const stage = figure.querySelector('.comparison-stage');
    const range = figure.querySelector('input[type="range"]');
    const images = [...stage.querySelectorAll('img')];
    figure.classList.add('comparison-ready'); figure.querySelector('.comparison-control').hidden = false;
    const update = () => {
      figure.style.setProperty('--comparison', range.value + '%');
      range.setAttribute('aria-valuetext', english ? `${range.value}% before image` : `%${range.value} önce görseli`);
    };
    range.addEventListener('input', update); update();
    const move = event => {
      const rect = stage.getBoundingClientRect();
      range.value = String(Math.round(Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100)))); update();
    };
    stage.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      stage.setPointerCapture(event.pointerId); move(event); range.focus({ preventScroll: true });
    });
    stage.addEventListener('pointermove', event => { if (stage.hasPointerCapture(event.pointerId)) move(event); });
    stage.addEventListener('pointerup', event => { if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId); });
    images.forEach(img => {
      img.draggable = false;
      if (!img.getAttribute('src').includes('comparison-placeholder.svg')) {
        img.alt = english ? (img.classList.contains('compare-before') ? 'Original image before editing' : 'Image after editing')
          : (img.classList.contains('compare-before') ? 'Düzenleme öncesi orijinal görsel' : 'Düzenleme sonrası görseli');
      }
    });
    const added = images.filter(img => !img.getAttribute('src').includes('comparison-placeholder.svg')).length;
    const note = figure.parentElement.querySelector('[data-comparison-note]');
    if (note && added === 2) note.textContent = english ? 'Comparison of the two uploaded images. See the caption for project context.' : 'Yüklenen iki görselin karşılaştırması. Proje bağlamı için açıklamayı okuyun.';
    else if (note && added === 1) note.textContent = english ? 'One original image has been added; the other is still a placeholder.' : 'Bir görsel eklendi; diğer görsel hâlâ yer tutucu.';
  };
  window.initPortfolioComparison = init;
  document.querySelectorAll('[data-comparison]').forEach(init);
})();
