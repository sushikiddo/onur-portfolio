(()=>{'use strict';
const groups=[['home','⌂','Anasayfa'],['about','👤','Hakkımda'],['projects','🎮','Projeler'],['gallery','🖼','Galeri'],['blog','✍','Blog'],['schedule','📅','Ders Programı'],['skills','📊','Yetenekler'],['contact','✉','İletişim']];
const names={'hero-title':'Ana slogan','hero-subtitle':'Slogan altı açıklama','schedule-time-0':'1. saat aralığı','schedule-time-1':'2. saat aralığı','schedule-time-2':'3. saat aralığı',bio:'Özgeçmiş', 'bio-short':'Kısa tanıtım',address:'Adres',phone:'Telefon',email:'E-posta'};
let model={fields:{},images:{}},section='about',language='tr',dirty=false,busy=false;
const $=id=>document.getElementById(id),status=$('status');
const draftKey='onur-portfolio-local-draft-v1';
function removeDraft(){try{localStorage.removeItem(draftKey)}catch{}}
Object.assign(names,{'bio-school':'Üniversite','bio-degree':'Bölüm ve sınıf'});
async function changeProject(payload){
 if(busy)return;
 if(dirty&&!await save())return;
 busy=true;document.querySelectorAll('#projectTools button').forEach(button=>button.disabled=true);
 try{
  const response=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Proje işlemi başarısız');
  model=result.model;render();notify(payload.action==='add'?'Yeni proje taslağı eklendi. Metin ve görselleri aşağıdaki alanlardan düzenleyebilirsin.':'Proje iki dildeki sayfalardan kaldırıldı. Görsel dosyaları ve yerel geri alma kaydı korundu.','ok');
 }catch(error){notify(error.message,'error')}finally{busy=false;document.querySelectorAll('#projectTools button').forEach(button=>button.disabled=false)}
}
Object.assign(names,{'project-compare-before':'Photoshop · Önce görseli','project-compare-after':'Photoshop · Sonra görseli','project-compare-caption':'Photoshop · Karşılaştırma açıklaması'});
function draftSnapshot(){return JSON.stringify({fields:model.fields,language,section,updated:new Date().toISOString()})}
function indicateDraft(){let saved;try{saved=localStorage.getItem(draftKey)}catch{};$('draftInfo').textContent=dirty?'● Kaydedilmemiş değişiklikler mevcut.':saved?'● Bu tarayıcıda saklanan taslak mevcut.':'✓ Kaydedilmemiş değişiklik yok.'}
function storeDraft(){if(!dirty)return;try{localStorage.setItem(draftKey,draftSnapshot());indicateDraft()}catch(e){notify('Taslak depolanamadı: '+e.message,'error')}}
let draftClock;function scheduleDraft(){clearTimeout(draftClock);draftClock=setTimeout(storeDraft,400);indicateDraft()}
function notify(msg,type=''){status.textContent=msg;status.className=type}
function group(key){if(key.startsWith('hero-'))return 'home';if(key.startsWith('schedule-time'))return 'schedule';if(key.startsWith('bio')||key==='portrait')return 'about';if(key.startsWith('project'))return 'projects';if(key.startsWith('gallery'))return 'gallery';if(key.startsWith('blog'))return 'blog';if(key.startsWith('course'))return 'schedule';if(key.startsWith('skill'))return 'skills';return 'contact'}
function label(key){const media=key.match(/^project-(\d+)-detail-(\d+)$/);if(media)return `Proje ${media[1]} \u00b7 Ek g\u00f6rsel ${media[2]}`;if(names[key])return names[key];let categoryKey=key.match(/^project-(\d+)-category-(tr|en)$/);if(categoryKey)return `Proje ${categoryKey[1]} · Kategori`;let k=key.replace(/-(tr|en)$/,'');if(names[k])return names[k];let m=k.match(/^(project|gallery|blog)-(\d+)-(title|desc|intro|purpose|tech|steps|result|challenges|p\d+)$/);if(m){let type={project:'Proje',gallery:'Fotoğraf',blog:'Yazı'}[m[1]];let part={challenges:'Kar\u015f\u0131la\u015f\u0131lan sorunlar',purpose:'Ama\u00e7',tech:'Kullan\u0131lan teknolojiler',steps:'Uygulama a\u015famalar\u0131',result:'Sonu\u00e7 / mevcut durum',title:'Başlık',desc:'Açıklama',intro:'Giriş',p1:'1. paragraf',p2:'2. paragraf',p3:'3. paragraf'}[m[3]];return `${type} ${m[2]} · ${part}`;}m=k.match(/^course-(\d+)-(\d+)$/);if(m)return `${['Pazartesi','Salı','Çarşamba','Perşembe','Cuma'][+m[1]]||'Gün'} · ${+m[2]+1}. ders`;m=k.match(/^skill-(\d+)$/);if(m)return `Yetenek ${+m[1]+1} · Yüzde`;return k}
function visibleKey(key){return group(key)===section && (!/-(tr|en)$/.test(key)||key.endsWith('-'+language)) && label(key).toLocaleLowerCase('tr').includes($('filter').value.toLocaleLowerCase('tr'))}
function renderMenu(){const nav=$('menu');nav.replaceChildren();for(const [id,icon,title] of groups){const b=document.createElement('button');b.className='nav'+(section===id?' active':'');b.type='button';b.textContent=icon+'  '+title;b.onclick=()=>{section=id;$('filter').value='';render()};nav.append(b)}}
function render(){renderMenu();window.renderProjectTools?.(model,section,language,changeProject);const title=groups.find(g=>g[0]===section)[2];$('sectionTitle').textContent=title;$('panelTitle').textContent=title+' bilgileri';$('fields').replaceChildren();$('images').replaceChildren();let count=0;for(const [key,value] of Object.entries(model.fields)){if(!visibleKey(key))continue;count++;const d=document.createElement('div');d.className='entry';const l=document.createElement('label');l.textContent=label(key);const t=document.createElement('textarea');t.id='f-'+key;l.htmlFor=t.id;t.value=value;t.rows=key.startsWith('bio')?8:key.includes('p1')||key.includes('p2')||key.includes('p3')?5:3;if(key.startsWith('schedule-time')){t.rows=1;t.placeholder='Örn. 09:00–10:50'};t.oninput=()=>{model.fields[key]=t.value;dirty=true;scheduleDraft();notify('Kaydedilmemiş değişiklikler var. Kaydet veya Taslağı sakla.')};d.append(l,t);$('fields').append(d)}for(const [key,path] of Object.entries(model.images)){if(group(key)!==section||$('filter').value&&!label(key).toLocaleLowerCase('tr').includes($('filter').value.toLocaleLowerCase('tr')))continue;count++;const d=document.createElement('div');d.className='photo';const img=document.createElement('img');img.src='/'+path;img.alt=label(key);const content=document.createElement('div');const l=document.createElement('label');l.textContent=key==='portrait'?'Profil fotoğrafı':label(key);const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif';input.setAttribute('aria-label',l.textContent+' yükle');const help=document.createElement('small');help.textContent='PNG, JPG, WEBP veya GIF · En fazla 5 MB';input.onchange=async()=>{const f=input.files?.[0];if(!f)return;if(f.size>5*1024*1024){notify('Görsel 5 MB altında olmalı.','error');return}input.disabled=true;const form=new FormData();form.append('name',key);form.append('file',f);try{const r=await fetch('/api/image',{method:'POST',body:form});const j=await r.json();if(!r.ok)throw Error(j.error||'Görsel yüklenemedi');model.images[key]=j.path;img.src='/'+j.path+'?v='+Date.now();notify('Fotoğraf siteye kaydedildi.','ok')}catch(e){notify('Fotoğraf kaydedilemedi: '+e.message,'error')}finally{input.disabled=false}};content.append(l,input,help);d.append(img,content);$('images').append(d)}$('empty').hidden=count!==0}
async function save(){if(busy)return false;busy=true;$('save').disabled=true;try{const r=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:model.fields})});const j=await r.json();if(!r.ok)throw Error(j.error||'Kayıt başarısız');dirty=false;clearTimeout(draftClock);try{removeDraft()}catch{};indicateDraft();notify('Değişiklikler site dosyalarına kaydedildi.','ok');return true}catch(e){notify('Kaydedilemedi: '+e.message,'error');return false}finally{busy=false;$('save').disabled=false}}

const sectionPages={home:['index.html','en/index.html'],about:['hakkimda.html','en/about.html'],projects:['projeler.html','en/projects.html'],gallery:['galeri.html','en/gallery.html'],blog:['blog.html','en/blog.html'],schedule:['hakkimda.html','en/about.html'],skills:['hakkimda.html','en/about.html'],contact:['iletisim.html','en/contact.html']};
async function preview(){
  const dialog=$('previewDialog'), frame=$('previewFrame');
  const path=sectionPages[section]?.[language==='en'?1:0]||'index.html';
  $('previewHeading').textContent=(language==='en'?'EN':'TR')+' · '+groups.find(x=>x[0]===section)[2]+' — Önizleme yükleniyor…';
  // Pencereyi tıklama anında aç: ağ hatası olsa bile kullanıcı tepki görsün.
  try {
    if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  }catch(e){dialog.setAttribute('open','');}
  frame.removeAttribute('src');
  frame.srcdoc='<!doctype html><html lang="tr"><meta charset="utf-8"><body style="font:16px system-ui;padding:28px">Önizleme yükleniyor…</body></html>';
  try{
    const response=await fetch('/'+path+'?preview='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('Sayfa okunamadı: HTTP '+response.status);
    const source=await response.text();
    const doc=new DOMParser().parseFromString(source,'text/html');
    // data-field özel karakterli olsa bile filtre kırılmasın.
    doc.querySelectorAll('[data-field]').forEach(node=>{
      const key=node.getAttribute('data-field');
      if(Object.prototype.hasOwnProperty.call(model.fields,key))node.textContent=model.fields[key];
    });
    doc.querySelectorAll('[data-skill-fill]').forEach(node=>{const value=Number(model.fields['skill-'+node.dataset.skillFill]?.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',','.'));node.style.width=(Number.isFinite(value)?Math.min(100,Math.max(0,value)):0)+'%'});
    const base=doc.createElement('base');
    base.href=new URL('/'+path,location.href).href;
    doc.head.prepend(base);
    // Panelin önizlemesine navigasyon yüzünden siteden çıkılmasını engelle.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin');
    frame.srcdoc='<!doctype html>\n'+doc.documentElement.outerHTML;
    $('previewHeading').textContent=(language==='en'?'EN':'TR')+' · '+groups.find(x=>x[0]===section)[2]+' — Kaydedilmemiş önizleme';
    notify('Önizleme açıldı. Metin değişiklikleri kaydedilmeden gösteriliyor.','ok');
  }catch(e){
    const errDoc=document.implementation.createHTMLDocument('Önizleme hatası');
    const p=errDoc.createElement('p');p.textContent='Önizleme açılamadı: '+e.message;errDoc.body.append(p);
    frame.srcdoc='<!doctype html>\n'+errDoc.documentElement.outerHTML;
    $('previewHeading').textContent='Önizleme hatası';
    notify('Önizleme oluşturulamadı: '+e.message,'error');
  }
}
$('preview').onclick=preview;$('previewReload').onclick=preview;$('previewClose').onclick=()=>(typeof $('previewDialog').close==='function'?$('previewDialog').close():$('previewDialog').removeAttribute('open'));
$('saveDraft').onclick=()=>{storeDraft();notify('Taslak yalnızca bu tarayıcıda saklandı. Henüz siteye kaydedilmedi.','ok')};
$('discardDraft').onclick=()=>{if(!confirm('Yerel taslağı silmek istiyor musun? Kaydedilmemiş değişiklikler de geri alınacak.'))return;removeDraft();location.reload()};
$('save').onclick=save;$('export').onclick=async()=>{if(!await save())return;location.href='/api/export';notify('Güncel site ZIP dosyası indiriliyor.','ok')};$('language').onchange=e=>{language=e.target.value;render();indicateDraft()};$('filter').oninput=render;window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
(async()=>{try{const r=await fetch('/api/data',{cache:'no-store'});if(!r.ok)throw Error('Sunucu hatası');model=await r.json();if(!model.fields||!model.images)throw Error('Panel sunucusu gerekli: python admin/server.py');let restored=false;try{const raw=localStorage.getItem(draftKey);if(raw){const d=JSON.parse(raw);if(d&&d.fields&&confirm('Kaydedilmemiş yerel taslak bulundu. Devam etmek ister misin?')){for(const [key,value] of Object.entries(d.fields)){if(Object.hasOwn(model.fields,key)&&typeof value==='string')model.fields[key]=value}language=d.language==='en'?'en':'tr';section=groups.some(g=>g[0]===d.section)?d.section:'about';$('language').value=language;dirty=true;restored=true}else removeDraft()}}catch(e){removeDraft()}render();indicateDraft();notify(restored?'Taslak geri yüklendi. Siteye uygulamak için Kaydet.':'Hazır. Sol menüden düzenlemek istediğin bölümü seç.','ok')}catch(e){notify('Yönetici sunucusuna ulaşılamadı. python admin/server.py komutunu çalıştır. '+e.message,'error')}})();

})();
