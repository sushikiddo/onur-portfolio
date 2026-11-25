import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import fs from 'node:fs/promises';
const paths=['index.html','hakkimda.html','projeler.html','galeri.html','blog.html','iletisim.html','en/index.html','en/about.html','en/projects.html','en/gallery.html','en/blog.html','en/contact.html'];
const pages=Object.fromEntries(paths.map(p=>[p,'<!doctype html><html><p data-field="bio-tr">Eski içerik</p><div><!-- PROJECTS:START --><!-- PROJECTS:END --></div></html>']));
function setup(initial={pages,fields:{}}){
 const rows=new Map([['content',{id:'content',revision:5,value:JSON.stringify(initial)}]]);
 let conflict=false;
 const env={ASSETS:{fetch:async()=>new Response('asset')},DB:{prepare(sql){let args=[];return{bind(...a){args=a;return this},async first(){if(sql.includes('SELECT expires'))return{expires:Date.now()/1000+500};if(sql.includes('INSERT INTO attempts'))return{count:1,reset_at:Date.now()/1000+60};if(sql.includes('FROM state')){const r=rows.get(args[0]);return r?{...r}:null}throw Error(sql)},async run(){if(sql.startsWith('INSERT OR IGNORE INTO state')){if(!rows.has(args[0]))rows.set(args[0],{id:args[0],value:args[1],revision:1});return{success:true,meta:{changes:1}}}if(sql.startsWith('UPDATE state')){const r=rows.get(args[1]);if(conflict||!r||args[2]!==r.revision)return{success:true,meta:{changes:0}};rows.set(args[1],{...r,value:args[0],revision:r.revision+1});return{success:true,meta:{changes:1}}}throw Error(sql)}}}}};
 return {env,get:()=>JSON.parse(rows.get('content').value),setConflict:()=>conflict=true};
}
function req(path,opts={}){return new Request('https://example.pages.dev'+path,opts)}
const auth={'Cookie':'session='+'a'.repeat(64)};
test('public site includes Komur and current design without mutating stored pages',async()=>{const s=setup();const r=await worker.fetch(req('/anasayfa.html'),s.env);assert.equal(r.status,200);const t=await r.text();assert.match(t,/Kömür/);assert.match(t,/og:site_name/);assert.equal(s.get().siteVersion,undefined)});
test('admin data requires a session',async()=>{const s=setup();const r=await worker.fetch(req('/api/data'),s.env);assert.equal(r.status,401)});
test('authenticated model includes editable Komur fields and old content',async()=>{const s=setup();const r=await worker.fetch(req('/api/data',{headers:auth}),s.env);assert.equal(r.status,200);const d=await r.json();assert.equal(d.fields['project-4-title-tr'],'Kömür');assert.ok(d.fields['project-4-p1-tr']);assert.ok(d.fields['bio-tr']);assert.ok(d.projects.some(p=>p.id===4&&p.title_tr==='Kömür'))});
test('save keeps legacy pages and updates public Komur page',async()=>{const s=setup();const r=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://example.pages.dev','Content-Type':'application/json'},body:JSON.stringify({fields:{'project-4-p1-tr':'Yeni <güvenli> açıklama'}})}),s.env);assert.equal(r.status,200);assert.deepEqual(s.get().legacyPagesBefore20261117,pages);assert.equal(s.get().siteVersion,'no-admin-footer-20261125-v12');const page=await worker.fetch(req('/komur'),s.env);assert.equal(page.status,200);assert.match(await page.text(),/Yeni &lt;güvenli&gt; açıklama/)});
test('cross-origin writes remain denied',async()=>{const s=setup();const r=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://other.invalid'},body:'{}'}),s.env);assert.equal(r.status,403)});
test('revision conflict does not overwrite content',async()=>{const s=setup();s.setConflict();const before=s.get();const r=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://example.pages.dev'},body:JSON.stringify({fields:{'project-4-title-tr':'Kömür yeni'}})}),s.env);assert.equal(r.status,409);assert.deepEqual(s.get(),before)});
test('private admin stays protected and logout script is private',async()=>{const s=setup();for(const p of ['/admin/','/admin/session.js']){const r=await worker.fetch(req(p),s.env);assert.ok([303,404].includes(r.status))}});

test('version migration keeps owner edits and replaces untouched old defaults',async()=>{
 const src=await fs.readFile(new URL('../_worker.js',import.meta.url),'utf8');
 const prev=JSON.parse(src.split('\n').find(l=>l.startsWith('var PREV_SITE_DEFAULTS = ')).slice('var PREV_SITE_DEFAULTS = '.length).replace(/;\s*$/,''));
 // A field whose old default no longer exists in the current pages (otherwise "replaced" is unobservable).
 const current=src.split('\n').find(l=>/^(const|var) CURRENT_SITE_PAGES ?=/.test(l));
 const key=Object.keys(prev.fields).find(k=>k!=='bio-tr'&&/-tr$/.test(k)&&prev.fields[k].length>20&&!current.includes(JSON.stringify(prev.fields[k]).slice(1,-1)));
 assert.ok(key,'an old default that changed in this version is recorded');
 const oldDefault=prev.fields[key];
 const old=Object.fromEntries(paths.map(p=>[p,'<!doctype html><html><p data-field="'+key+'">'+oldDefault+'</p><p data-field="bio-tr">Kendi yazdığım biyografi</p></html>']));
 const s=setup({pages:old,fields:{},siteVersion:'komur-20261117-v1'});
 const home=await (await worker.fetch(req('/anasayfa.html'),s.env)).text();
 assert.ok(!home.includes(oldDefault),'untouched old intro is replaced');
 assert.match(home,/Programlamaya Python ile başladım/);
 const about=await (await worker.fetch(req('/hakkimda.html'),s.env)).text();
 assert.match(about,/Kendi yazdığım biyografi/,'owner-edited bio survives: '+(about.match(/data-field="bio-tr"[^>]*>.{0,50}/)||['none'])[0]);
});

test('version migration does not resurrect projects deleted in the panel',async()=>{
 const art=n=>'<article class="card" data-project-id="'+n+'"><h3>P'+n+'</h3></article>';
 const build=ids=>Object.fromEntries(paths.map(p=>[p,'<!doctype html><html><div><!-- PROJECTS:START -->'+ids.map(art).join('')+'<!-- PROJECTS:END --></div></html>']));
 // Explicit record: id 3 was deleted.
 let s=setup({pages:build([1,2]),fields:{},siteVersion:'komur-20261117-v1',deletedProjects:[3]});
 let t=await (await worker.fetch(req('/projeler.html'),s.env)).text();
 assert.ok(t.includes('data-project-id="6"')&&t.includes('data-project-id="2"'));
 assert.ok(!t.includes('data-project-id="1"'),'Space is replaced by the homework');
 assert.ok(!t.includes('data-project-id="3"'),'recorded deletion stays deleted');
 // Old state without the record: a gap among the stored ids (2) means it was deleted.
 s=setup({pages:build([1,3]),fields:{},siteVersion:'komur-20261117-v1'});
 t=await (await worker.fetch(req('/projeler.html'),s.env)).text();
 assert.ok(t.includes('data-project-id="3"')&&!t.includes('data-project-id="2"'),'inferred deletion stays deleted');
});

test('404.html is publicly fetchable for ZIP export and CSP includes script-src',async()=>{
 const s=setup();
 const r=await worker.fetch(req('/404.html'),s.env);
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-security-policy')||'',/script-src 'self'/);
});

test('serveMedia falls back to static ASSETS when D1 uploads has no row',async()=>{
 const s=setup();
 const origPrepare=s.env.DB.prepare;
 s.env.DB.prepare=sql=>sql.includes('FROM uploads')?{bind(){return this},async first(){return null}}:origPrepare.call(s.env.DB,sql);
 const r=await worker.fetch(req('/media/8927bb45-486d-4006-b79e-bdb903626fca.png'),s.env);
 assert.equal(r.status,200);
});

test('3D world online API persists circuit scores, whispers, cookies and cataclysm',async()=>{
 const s=setup();
 const h={Origin:'https://example.pages.dev','Content-Type':'application/json'};
 const initRes=await worker.fetch(req('/api/world'),s.env);
 assert.equal(initRes.status,200);
 const initData=await initRes.json();
 assert.equal(initData.type,'init');
 assert.deepEqual(initData.circuitLeaderboard,[]);

 const cRes=await worker.fetch(req('/api/world',{method:'POST',headers:h,body:JSON.stringify({type:'circuitInsert',tag:'ONR',countryCode:'tr',duration:24500})}),s.env);
 assert.equal(cRes.status,200);
 assert.deepEqual((await cRes.json()).circuitLeaderboard,[['ONR','tr',24500]]);

 const wRes=await worker.fetch(req('/api/world',{method:'POST',headers:h,body:JSON.stringify({type:'whispersInsert',uuid:'u1',message:'Merhaba 3D!',countryCode:'tr',x:1,y:2,z:3})}),s.env);
 assert.equal(wRes.status,200);
 assert.equal((await wRes.json()).whispers[0].message,'Merhaba 3D!');

 const kRes=await worker.fetch(req('/api/world',{method:'POST',headers:h,body:JSON.stringify({type:'cookiesInsert',amount:5})}),s.env);
 assert.equal(kRes.status,200);
 assert.equal((await kRes.json()).cookiesCount,5);

 const aRes=await worker.fetch(req('/api/world',{method:'POST',headers:h,body:JSON.stringify({type:'cataclysmInsert'})}),s.env);
 assert.equal(aRes.status,200);
 assert.equal((await aRes.json()).cataclysmCount,1);
});

test('world-projects endpoint syncs D1 projects for 3D ProjectsArea',async()=>{
 const s=setup();
 const r=await worker.fetch(req('/api/world-projects'),s.env);
 assert.equal(r.status,200);
 const d=await r.json();
 assert.ok(Array.isArray(d.projects)&&d.projects.some(p=>p.id===4&&p.title_tr==='Kömür'));
});

test('contact inbox and admin moderation require auth and persist cleanly',async()=>{
 const s=setup();
 const h={Origin:'https://example.pages.dev','Content-Type':'application/json'};
 const postRes=await worker.fetch(req('/api/contact',{method:'POST',headers:h,body:JSON.stringify({name:'Test Kullanıcı',email:'test@example.com',subject:'Merhaba',message:'Bu bir test mesajıdır, on karakterden uzun.'})}),s.env);
 assert.equal(postRes.status,200);

 const unauth=await worker.fetch(req('/api/admin/extras'),s.env);
 assert.equal(unauth.status,401);

 const exRes=await worker.fetch(req('/api/admin/extras',{headers:auth}),s.env);
 assert.equal(exRes.status,200);
 const ex=await exRes.json();
 assert.equal(ex.messages.length,1);
 assert.equal(ex.messages[0].subject,'Merhaba');

 const delRes=await worker.fetch(req('/api/admin/moderate',{method:'POST',headers:{...auth,...h},body:JSON.stringify({action:'deleteMessage',id:ex.messages[0].id})}),s.env);
 assert.equal(delRes.status,200);
 assert.equal((await delRes.json()).messages.length,0);
});

const visualRoutes=['kirmizi-bisiklet.html','nova-audio.html','batman-renklendirme.html','kapadokya-balonlar.html','antalya-sahili.html','pera-muzesi.html'];
const visualEnglish=['selective-colour.html','nova-audio.html','batman-colourisation.html','cappadocia-balloons.html','antalya-coast.html','pera-museum.html'];
test('six independent personal projects migrate from the aggregate and preserve owner content',async()=>{
 const initial=Object.fromEntries(paths.map(path=>[path,'<!doctype html><html><p data-field="bio-tr">Owner biography</p><article data-project-id="4"><h3 data-field="project-4-title-tr">Kömür</h3><p data-field="project-4-desc-tr">Owner description</p></article><article data-project-id="5"><h3 data-field="project-5-title-tr">Grafik Animasyon 1 — Vize Çalışmaları</h3></article> <!-- PROJECTS:START --><!-- PROJECTS:END --></html>']));
 const s=setup({pages:initial,siteVersion:'graphic-animation-20261124-v1',deletedProjects:[1,2,3]});
 for(const path of ['/projeler.html','/en/projects.html','/anasayfa.html','/en/index.html']){
  const r=await worker.fetch(req(path),s.env);assert.equal(r.status,200);const t=await r.text();
  const ids=[...t.matchAll(/data-project-id="(\d+)"/g)].map(m=>Number(m[1]));
  assert.deepEqual(ids,[4,6,7,8,9,10,11]);
  assert.doesNotMatch(t,/Space Survivor|Vize|Midterm|ödev|homework|assignment/i);
 }
 for(let i=0;i<6;i++)for(const path of ['/'+visualRoutes[i],'/en/'+visualEnglish[i]]){
  const r=await worker.fetch(req(path),s.env);assert.equal(r.status,200,path);const t=await r.text();
  assert.match(t,new RegExp('data-field="project-'+(i+6)+'-title-'));
  assert.match(t,new RegExp('p'+(i+1)+'-(?:sonrasi|oncesi|taslak)\\.webp'));
  assert.match(t,/hQuNqDB1BqI/);
  assert.doesNotMatch(t,/vize|midterm|ödev|homework|assignment|educational|eğitim amaçlı|20261121801|0541|\.docx/i);
 }
 const model=await(await worker.fetch(req('/api/data',{headers:auth}),s.env)).json();
 assert.deepEqual(model.projects.map(p=>p.id),[4,6,7,8,9,10,11]);
 assert.equal(model.fields['project-4-desc-tr'],'Owner description');
 const about=await(await worker.fetch(req('/hakkimda.html'),s.env)).text();assert.match(about,/Owner biography/);
 const saved=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://example.pages.dev','Content-Type':'application/json'},body:JSON.stringify({fields:{'project-7-p1-tr':'My revised poster process'}})}),s.env);
 assert.equal(saved.status,200);
 const poster=await(await worker.fetch(req('/nova-audio.html'),s.env)).text();assert.match(poster,/My revised poster process/);
 const live=await(await worker.fetch(req('/api/world-projects'),s.env)).json();
 for(let i=0;i<6;i++)assert.equal(live.projects.find(p=>p.id===i+6).url,'/'+visualRoutes[i]);
 for(const [old,target] of [['/grafik-animasyon.html','/projeler.html'],['/en/graphic-animation.html','/en/projects.html']]){
  const r=await worker.fetch(req(old),s.env);assert.equal(r.status,301);assert.equal(r.headers.get('location'),target);
 }
});

test('introducing six designs preserves colliding custom projects and deleted identities',async()=>{
 const card='<article data-project-id="6"><h3 data-field="project-6-title-tr">Owner custom project</h3><p data-field="project-6-desc-tr">Owner custom description</p><img data-image="project-6" src="media/owner.png"/><a class="project-open" href="https://example.com/owner">Open</a></article>';
 const old=Object.fromEntries(paths.map(p=>[p,'<!doctype html><html><!-- PROJECTS:START -->'+(['index.html','projeler.html','en/index.html','en/projects.html'].includes(p)?card:'')+'<!-- PROJECTS:END --></html>']));
 const s=setup({pages:old,siteVersion:'graphic-animation-20261124-v1',deletedProjects:[1,2,3,7]});
 const api=await(await worker.fetch(req('/api/world-projects'),s.env)).json();
 assert.ok(api.projects,JSON.stringify(api));
 assert.ok(api.projects.some(p=>p.id===7&&p.url==='/nova-audio.html'),'a deleted legacy id does not hide a new design');
 const custom=api.projects.find(p=>p.title_tr==='Owner custom project');assert.ok(custom);assert.ok(custom.id>11);assert.equal(custom.url,'https://example.com/owner');assert.equal(custom.image,'/media/owner.png');
 const red=api.projects.find(p=>p.id===6);assert.equal(red.title_tr,'History Brush — Kırmızı Bisiklet');assert.equal(red.image,'/assets/img/grafik-animasyon/p1-sonrasi.webp');
 assert.equal(s.get().pages['projeler.html'],old['projeler.html'],'read migration never writes stored state');
});

test('root opens Anasayfa and the 3D world stays available at /3d',async()=>{
 const s=setup();let asked;s.env.ASSETS.fetch=async r=>{asked=new URL(r.url).pathname;return new Response('world')};
 for(const p of ['/','/index.html']){const r=await worker.fetch(req(p),s.env);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/anasayfa.html')}
 const w=await worker.fetch(req('/3d'),s.env);assert.equal(w.status,200);assert.equal(await w.text(),'world');assert.equal(asked,'/');
 assert.equal((await worker.fetch(req('/3d/'),s.env)).headers.get('location'),'/3d');
 const about=await (await worker.fetch(req('/hakkimda.html'),s.env)).text();
 assert.match(about,/class="world-link" href="\/3d"/);assert.ok(!about.includes('class="world-link" href="/"'));
});

test('Kömür helper cat is added once to every public page',async()=>{
 const s=setup();
 for(const p of ['/anasayfa.html','/hakkimda.html','/en/projects.html']){const t=await (await worker.fetch(req(p),s.env)).text();assert.equal(t.split('komur-pet.js').length-1,1,p)}
 assert.ok(!JSON.stringify(s.get()).includes('komur-pet.js'),'stored pages stay untouched');
 for(const a of ['/assets/js/komur-pet.js','/assets/komur/frames.js','/assets/komur/meow.mp3'])assert.equal(await (await worker.fetch(req(a),s.env)).text(),'asset',a);
});
