(() => {
 'use strict';
 const panel=document.createElement('section');panel.id='projectTools';panel.className='panel';panel.hidden=true;panel.style.marginBottom='24px';
 panel.innerHTML='<h2>Proje yönetimi</h2><p class="muted">Ekleme ve silme, Türkçe/İngilizce anasayfa ve proje sayfalarına birlikte uygulanır. Yeni proje taslak olarak başlar.</p><div class="controls"><label>Türkçe başlık<input id="newProjectTR" maxlength="160" required value="Yeni proje (taslak)"></label><label>English title<input id="newProjectEN" maxlength="160" required value="New project (draft)"></label><button id="addProject" class="primary" type="button">Yeni proje ekle</button></div><div id="projectList"></div>';
 document.querySelector('section.panel').before(panel);
 window.renderProjectTools=(model,section,language,change)=>{
  panel.hidden=section!=='projects';if(panel.hidden)return;
  const list=document.getElementById('projectList');list.replaceChildren();
  (model.projects||[]).forEach(project=>{
   const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid #d3ddea';
   const text=document.createElement('span');text.textContent=project.id+' · '+project['title_'+language];
   const button=document.createElement('button');button.type='button';button.className='outline';button.textContent='Projeyi sil';button.setAttribute('aria-label',text.textContent+' — Projeyi sil');button.dataset.deleteProject=String(project.id);
   button.addEventListener('click',()=>{if(confirm('“'+project['title_'+language]+'” projesi iki dildeki anasayfa ve projeler sayfalarından kaldırılacak. Devam edilsin mi?'))change({action:'delete',id:project.id})});row.append(text,button);list.append(row);
  });
  document.getElementById('addProject').onclick=()=>{
   const tr=document.getElementById('newProjectTR'),en=document.getElementById('newProjectEN');
   if(!tr.value.trim()||!en.value.trim()){tr.reportValidity();en.reportValidity();return}
   change({action:'add',title_tr:tr.value,title_en:en.value});
  };
 };
})();
