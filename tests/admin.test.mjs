import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import fs from 'node:fs/promises';
const paths=['index.html','hakkimda.html','projeler.html','galeri.html','blog.html','iletisim.html','en/index.html','en/about.html','en/projects.html','en/gallery.html','en/blog.html','en/contact.html'];
const pages=Object.fromEntries(paths.map(p=>[p,'<!doctype html><html><p data-field="bio-tr">Eski içerik</p><div><!-- PROJECTS:START --><!-- PROJECTS:END --></div></html>']));
function setup(initial={pages,fields:{}}){
 let row={id:'content',revision:5,value:JSON.stringify(initial)};
 let conflict=false;
 const env={ASSETS:{fetch:async()=>new Response('asset')},DB:{prepare(sql){let args;return{bind(...a){args=a;return this},async first(){if(sql.includes('SELECT expires'))return{expires:Date.now()/1000+500};if(sql.includes('FROM state'))return {...row};throw Error(sql)},async run(){if(sql.startsWith('UPDATE state')){if(conflict||args[2]!==row.revision)return{success:true,meta:{changes:0}};row={...row,value:args[0],revision:row.revision+1};return{success:true,meta:{changes:1}}}throw Error(sql)}}}}};
 return {env,get:()=>JSON.parse(row.value),setConflict:()=>conflict=true};
}
function req(path,opts={}){return new Request('https://example.pages.dev'+path,opts)}
const auth={'Cookie':'session='+'a'.repeat(64)};
test('public site includes Komur and current design without mutating stored pages',async()=>{const s=setup();const r=await worker.fetch(req('/'),s.env);assert.equal(r.status,200);const t=await r.text();assert.match(t,/Kömür/);assert.match(t,/og:site_name/);assert.equal(s.get().siteVersion,undefined)});
test('admin data requires a session',async()=>{const s=setup();const r=await worker.fetch(req('/api/data'),s.env);assert.equal(r.status,401)});
test('authenticated model includes editable Komur fields and old content',async()=>{const s=setup();const r=await worker.fetch(req('/api/data',{headers:auth}),s.env);assert.equal(r.status,200);const d=await r.json();assert.equal(d.fields['project-4-title-tr'],'Kömür');assert.ok(d.fields['project-4-p1-tr']);assert.ok(d.fields['bio-tr']);assert.ok(d.projects.some(p=>p.id===4&&p.title_tr==='Kömür'))});
test('save keeps legacy pages and updates public Komur page',async()=>{const s=setup();const r=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://example.pages.dev','Content-Type':'application/json'},body:JSON.stringify({fields:{'project-4-p1-tr':'Yeni <güvenli> açıklama'}})}),s.env);assert.equal(r.status,200);assert.deepEqual(s.get().legacyPagesBefore20261117,pages);assert.equal(s.get().siteVersion,'human-20261121-v2');const page=await worker.fetch(req('/komur'),s.env);assert.equal(page.status,200);assert.match(await page.text(),/Yeni &lt;güvenli&gt; açıklama/)});
test('cross-origin writes remain denied',async()=>{const s=setup();const r=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://other.invalid'},body:'{}'}),s.env);assert.equal(r.status,403)});
test('revision conflict does not overwrite content',async()=>{const s=setup();s.setConflict();const before=s.get();const r=await worker.fetch(req('/api/save',{method:'POST',headers:{...auth,Origin:'https://example.pages.dev'},body:JSON.stringify({fields:{'project-4-title-tr':'Kömür yeni'}})}),s.env);assert.equal(r.status,409);assert.deepEqual(s.get(),before)});
test('private admin stays protected and logout script is private',async()=>{const s=setup();for(const p of ['/admin/','/admin/session.js']){const r=await worker.fetch(req(p),s.env);assert.ok([303,404].includes(r.status))}});

test('version migration keeps owner edits and replaces untouched old defaults',async()=>{
 const src=await fs.readFile(new URL('../_worker.js',import.meta.url),'utf8');
 const prev=JSON.parse(src.split('\n').find(l=>l.startsWith('var PREV_SITE_DEFAULTS = ')).slice('var PREV_SITE_DEFAULTS = '.length).replace(/;\s*$/,''));
 const oldDefault=prev.fields['bio-short-tr'];
 assert.ok(oldDefault,'old default for bio-short-tr is recorded');
 const old=Object.fromEntries(paths.map(p=>[p,'<!doctype html><html><p data-field="bio-short-tr">'+oldDefault+'</p><p data-field="bio-tr">Kendi yazdığım biyografi</p></html>']));
 const s=setup({pages:old,fields:{},siteVersion:'komur-20261117-v1'});
 const home=await (await worker.fetch(req('/'),s.env)).text();
 assert.ok(!home.includes(oldDefault),'untouched old intro is replaced');
 assert.match(home,/Programlamaya Python ile başladım/);
 const about=await (await worker.fetch(req('/hakkimda.html'),s.env)).text();
 assert.match(about,/Kendi yazdığım biyografi/,'owner-edited bio survives: '+(about.match(/data-field="bio-tr"[^>]*>.{0,50}/)||['none'])[0]);
});
