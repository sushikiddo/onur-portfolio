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
test('save keeps legacy pages and updates public Komur page',async()=>{const s=setup();const r=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://example.pages.dev','Content-Type':'application/json'},body:JSON.stringify({fields:{'project-4-p1-tr':'Yeni <güvenli> açıklama'}})}),s.env);assert.equal(r.status,200);assert.deepEqual(s.get().legacyPagesBefore20261117,pages);assert.equal(s.get().siteVersion,'komur-mac-win-20261124-v7');const page=await worker.fetch(req('/komur'),s.env);assert.equal(page.status,200);assert.match(await page.text(),/Yeni &lt;güvenli&gt; açıklama/)});
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
 assert.ok(t.includes('data-project-id="1"')&&t.includes('data-project-id="2"'));
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
