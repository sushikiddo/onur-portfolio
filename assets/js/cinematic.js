(() => {
  'use strict';
  const root = document.documentElement;
  const motionStyles=document.createElement('link');
  motionStyles.rel='stylesheet';
  motionStyles.href=new URL('../css/motion.css',document.currentScript.src).href;
  document.head.append(motionStyles);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const main = document.querySelector('main');
  const header = document.querySelector('.top');
  const canvas = document.getElementById('heroSculpture');

  // Readable with JavaScript disabled; animation is an enhancement only.
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const items = document.querySelectorAll('.section-heading,.home-intro .intro-heading,.education-grid,.focus-card,.article .visual,.gallery .visual,[data-project-id] .visual,[data-project-id] .inner h3,[data-project-id] .inner p');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), {threshold: .06, rootMargin: '0px 0px -24px'});
    items.forEach((item, index) => { item.classList.add('reveal-ready'); item.style.setProperty('--reveal-delay', (index % 4) * 65 + 'ms'); observer.observe(item); });
    reduced.addEventListener('change', () => { if (reduced.matches) items.forEach(item => item.classList.add('is-visible')); });
  }
  const curtain=document.createElement('div');
  curtain.className='page-curtain';curtain.setAttribute('aria-hidden','true');document.body.append(curtain);
  if (!reduced.matches) {curtain.classList.add('curtain-enter');setTimeout(()=>curtain.classList.remove('curtain-enter'),650);}
  let navigating=false;
  if (!reduced.matches) main?.classList.add('page-enter');
  main?.addEventListener('animationend', event => { if (event.target === main) main.classList.remove('page-enter'); });
  addEventListener('pageshow', () => {root.classList.remove('page-leaving');curtain.classList.remove('curtain-exit');navigating=false;});
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, document.baseURI);
    if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.origin !== location.origin || url.protocol !== location.protocol || !url.pathname.endsWith('.html') || url.pathname === location.pathname) return;
    if (navigating) {event.preventDefault();return;}
    event.preventDefault();navigating=true;main?.classList.remove('page-enter');curtain.classList.remove('curtain-enter');curtain.classList.add('curtain-exit');
    setTimeout(() => { location.href = url.href; }, 340);
  });
  const progress = document.createElement('div');
  progress.setAttribute('aria-hidden', 'true');
  Object.assign(progress.style, {position:'fixed',top:'0',left:'0',height:'2px',width:'100%',transformOrigin:'left',transform:'scaleX(0)',background:'linear-gradient(90deg,#6588ff,#82e4ef)',zIndex:'9999',pointerEvents:'none'});
  document.body.append(progress);
  let scrollFrame = 0;
  function updateScroll() {
    scrollFrame = 0; header?.classList.toggle('is-scrolled', scrollY > 30);
    const distance = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, scrollY / distance) : 0})`;
  }
  addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, {passive:true});
  updateScroll();
  document.querySelectorAll('[data-project-id]').forEach(card => {
    card.dataset.tilt = '';
    card.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches || event.target.closest('a,button,summary,input')) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--tilt-x', ((event.clientY-r.top)/r.height-.5)*-2.5+'deg');
      card.style.setProperty('--tilt-y', ((event.clientX-r.left)/r.width-.5)*2.5+'deg');
    });
    card.addEventListener('pointerleave', () => {card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');});
  });
  document.querySelectorAll('.hero-copy .btn').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches) return;
      const r=button.getBoundingClientRect();
      button.style.transform=`translate(${(event.clientX-r.left-r.width/2)*.07}px, ${(event.clientY-r.top-r.height/2)*.1}px)`;
    });
    button.addEventListener('pointerleave', () => {button.style.transform='';});
    button.addEventListener('blur', () => {button.style.transform='';});
  });

  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  let width=0,height=0,dpr=1,visible=true,frame=0,phase=0,previous=0;
  let pointerX=0,pointerY=0,targetX=0,targetY=0;
  function resize() {
    const rect=canvas.getBoundingClientRect(); width=rect.width; height=rect.height;
    dpr=Math.min(devicePixelRatio || 1, innerWidth<700 ? 1.5 : 2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    context.setTransform(dpr,0,0,dpr,0,0); draw();
  }
  const rotate = (point, ay, ax) => {
    const [x,y,z]=point, cy=Math.cos(ay),sy=Math.sin(ay),cx=Math.cos(ax),sx=Math.sin(ax);
    const xx=x*cy-z*sy, zz=x*sy+z*cy;
    return [xx,y*cx-zz*sx,y*sx+zz*cx];
  };
  function draw() {
    if (!width || !height) return;
    const ctx=context, size=Math.min(width,height), radius=size*.285, cx=width*.5, cy=height*.49;
    ctx.clearRect(0,0,width,height);
    const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*1.75);
    halo.addColorStop(0,'rgba(63,108,255,.24)');halo.addColorStop(.5,'rgba(50,79,198,.10)');halo.addColorStop(1,'rgba(30,53,153,0)');
    ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
    const ay=phase*.22+pointerX*.38, ax=-.22+pointerY*.25;
    const project = point => {const p=rotate(point,ay,ax), scale=3.5/(3.5-p[2]*.44);return {x:cx+p[0]*radius*scale,y:cy+p[1]*radius*scale,z:p[2],scale};};
    const line=(points,color,weight=1) => {ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke();};
    // A continuous latitude/longitude lattice gives the form depth and structure.
    for(let lat=-4;lat<=4;lat++) {
      const a=lat*Math.PI/10, points=[];
      for(let i=0;i<=80;i++){const t=i*Math.PI*2/80;points.push([Math.cos(a)*Math.cos(t),Math.sin(a),Math.cos(a)*Math.sin(t)]);}
      line(points,'rgba(113,159,255,.19)',.8);
    }
    for(let lon=0;lon<12;lon++) {
      const a=lon*Math.PI/12, points=[];
      for(let i=0;i<=80;i++){const t=i*Math.PI*2/80;points.push([Math.cos(t)*Math.cos(a),Math.sin(t),Math.cos(t)*Math.sin(a)]);}
      line(points,'rgba(121,171,255,.20)',.8);
    }
    // Fibonacci-distributed nodes remain attached to the rotating surface.
    const count=innerWidth<700?75:130;
    const points=[];
    for(let i=0;i<count;i++) {
      const y=1-2*(i+.5)/count, rr=Math.sqrt(1-y*y), a=i*2.399963;
      points.push(project([Math.cos(a)*rr,y,Math.sin(a)*rr]));
    }
    points.sort((a,b)=>a.z-b.z).forEach((p,i)=>{
      const alpha=.25+(p.z+1)*.3;ctx.beginPath();ctx.arc(p.x,p.y,(i%11===0?2.1:1.05)*p.scale,0,Math.PI*2);
      ctx.fillStyle=`rgba(179,220,255,${alpha})`;ctx.fill();
    });
    // Three orbital paths and their moving satellites frame the lattice.
    for(let ring=0;ring<3;ring++) {
      const tilt=[.36,1.05,-.68][ring], rad=1.24+ring*.12, path=[];
      for(let i=0;i<=110;i++){const t=i*Math.PI*2/110;path.push([rad*Math.cos(t),rad*Math.sin(t)*Math.sin(tilt),rad*Math.sin(t)*Math.cos(tilt)]);}
      line(path,ring===1?'rgba(111,228,235,.38)':'rgba(144,176,255,.30)',.9);
      const t=phase*(.34+ring*.08)+ring*2.2, p=project([rad*Math.cos(t),rad*Math.sin(t)*Math.sin(tilt),rad*Math.sin(t)*Math.cos(tilt)]);
      ctx.save();ctx.shadowColor='#80dfff';ctx.shadowBlur=18;ctx.fillStyle='#d1f4ff';ctx.beginPath();ctx.arc(p.x,p.y,2.6,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    const core=ctx.createRadialGradient(cx-radius*.18,cy-radius*.22,0,cx,cy,radius*.9);
    core.addColorStop(0,'rgba(171,211,255,.20)');core.addColorStop(.5,'rgba(70,119,255,.06)');core.addColorStop(1,'rgba(44,77,195,0)');ctx.fillStyle=core;ctx.beginPath();ctx.arc(cx,cy,radius*.95,0,Math.PI*2);ctx.fill();
  }
  function tick(time) {
    frame=0;if (!visible || document.hidden || reduced.matches) return;
    if(previous) phase+=Math.min((time-previous)/1000,.05);previous=time;
    pointerX+=(targetX-pointerX)*.035;pointerY+=(targetY-pointerY)*.035;draw();frame=requestAnimationFrame(tick);
  }
  function start(){if(!frame&&visible&&!document.hidden&&!reduced.matches){previous=0;frame=requestAnimationFrame(tick)}else if(reduced.matches){cancelAnimationFrame(frame);frame=0;draw()}}
  const hero=canvas.closest('.hero-world') || canvas.parentElement;
  hero?.addEventListener('pointermove',event=>{if(!fine.matches||reduced.matches)return;const r=hero.getBoundingClientRect();targetX=(event.clientX-r.left)/r.width-.5;targetY=(event.clientY-r.top)/r.height-.5;});
  hero?.addEventListener('pointerleave',()=>{targetX=0;targetY=0;});
  if ('IntersectionObserver' in window) new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0}else start();}).observe(canvas);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else addEventListener('resize',resize);
  document.addEventListener('visibilitychange',start);reduced.addEventListener('change',start);
  resize();start();
})();

