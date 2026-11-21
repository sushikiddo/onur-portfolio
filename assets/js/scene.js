// Fixed full-viewport WebGL layer, on every page (desktop only, see cinematic.js):
//   1. a calm dust field with scroll-velocity parallax
//   2. "media planes": every content <img> is mirrored by a textured plane that bends in like rising paper,
//      ripples with scroll velocity, carries a holographic sheen and rounded corners.
// The DOM <img> stays for layout, a11y and as the fallback (class `gl-on` hides it once the plane is ready).
// Driven by window.__pf (smoothed scroll + the one shared rAF loop).
// The about portrait stays a DOM image: its source needs the CSS crop (scale/object-position) that a plane can't reproduce.
const IMG_SEL = '.card .visual img,.card .image img,.gallery img,.article img';
const SKIP = 'header,footer,dialog,.top,.site-footer,.comparison,.project-gallery-source,[hidden],[inert]';
const MIN = 120;       // px: smaller images stay DOM-only
const MAX_TEX = 2048;  // px: longest texture side
const PAL = {
  light: {dust: [0x2B2420, 0x5E5248, 0xB4532A], opacity: .42},
  dark: {dust: [0xEFE6D6, 0xD9774A, 0xB9AB96], opacity: .55}
};
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

const DUST_VS = `
attribute float aSeed; attribute vec3 aColor;
uniform vec2 uRes; uniform float uTime, uScroll, uVel, uPR;
varying vec3 vColor; varying float vFade, vStretch;
void main(){
  float depth = position.z;
  float H = uRes.y;
  float y = mod(position.y * H + uTime * (5. + depth * 22.) + uScroll * (.12 + .6 * depth), H);
  float x = position.x * uRes.x + sin(uTime * .15 + aSeed * 6.2831) * 16. * (.4 + depth);
  float st = abs(uVel);
  gl_Position = projectionMatrix * vec4(x, y, 0., 1.);
  gl_PointSize = (1.3 + depth * 2.4 + aSeed * 1.2) * uPR * (1. + st * 2.2);
  vColor = aColor;
  vStretch = st;
  vFade = (.3 + .7 * depth) * smoothstep(0., 60., y) * smoothstep(0., 60., H - y);
}`;
const DUST_FS = `
uniform float uOpacity; varying vec3 vColor; varying float vFade, vStretch;
void main(){
  vec2 c = gl_PointCoord - .5;
  float d = length(vec2(c.x * (1. + vStretch * 2.2), c.y));
  float a = (1. - smoothstep(.15, .5, d)) * vFade * uOpacity;
  if (a < .003) discard;
  gl_FragColor = vec4(vColor, a);
}`;

const MEDIA_VS = `
uniform vec2 uSize; uniform float uP, uVel, uTime;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 pos = position;                      // -.5 .. .5, uv.y = 1 at the top
  float curl = pow(1. - uP, 2.);            // 1 below the fold -> 0 once risen
  float t = uv.y, arc = sin(t * 3.14159);
  pos.y -= curl * (arc * .09 + t * t * .11) + curl * 70. / uSize.y; // top edge curls back, sheet rises
  pos.x *= 1. - curl * t * .09;                                       // far edge reads as farther away
  pos.y += sin(uv.x * 7. + uv.y * 3. + uTime * 3.) * uVel * 16. / uSize.y; // ripple while scrolling
  pos.y -= arc * uVel * .035;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
}`;
const MEDIA_FS = `
uniform sampler2D uTex; uniform vec2 uSize, uImg;
uniform float uP, uVel, uTime, uHover, uSweep;
varying vec2 vUv;
vec3 pal(float t){ return .5 + .5 * cos(6.28318 * (t + vec3(0., .33, .67))); }
void main(){
  vec2 q = abs(vUv * uSize - uSize * .5) - uSize * .5 + 6.;           // rounded corners, 6px
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - 6.;
  float edge = 1. - smoothstep(-1., 0., d);
  if (edge < .01) discard;
  float pa = uSize.x / uSize.y, ia = uImg.x / uImg.y;                  // object-fit: cover
  vec2 s = pa > ia ? vec2(1., ia / pa) : vec2(pa / ia, 1.);
  vec2 uv = (vUv - .5) * s / (1. + .04 * uHover) + .5;
  float split = .0025 + .006 * abs(uVel);
  vec4 base = texture2D(uTex, uv);
  vec3 c = vec3(texture2D(uTex, uv + vec2(split, 0.)).r, base.g, texture2D(uTex, uv - vec2(split, 0.)).b);
  float band = uv.x * 1.1 + uv.y * .7 - uTime * .12;                  // holographic sheen
  vec3 holo = pal(band);
  float k = (1. - uP) * .55 + abs(uVel) * .25;
  c += (holo - .5) * k * .7;
  float x = vUv.x * .8 + vUv.y * .3, ctr = mix(-.3, 1.3, uSweep);     // hover sweep
  c += holo * exp(-pow((x - ctr) * 6., 2.)) * .45 * sin(uSweep * 3.14159);
  gl_FragColor = vec4(c, base.a * edge);
}`;

export async function start(canvas, pf) {
  pf = pf || window.__pf;
  if (!pf || !pf.add || !canvas) return false;
  let THREE;
  try { THREE = await import(new URL('../vendor/three.module.min.js', import.meta.url).href); } catch { return false; }
  THREE.ColorManagement.enabled = false; // shaders output raw sRGB values
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'high-performance'}); } catch { return false; }
  if (!renderer.getContext()) return false;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 10);
  camera.position.z = 5;
  const root = document.documentElement;
  let W = 1, H = 1;

  // ---- dust ----------------------------------------------------------------------------------
  const N = 360, tints = new THREE.Color();
  const dPos = new Float32Array(N * 3), dSeed = new Float32Array(N), dCol = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { dPos[i * 3] = Math.random(); dPos[i * 3 + 1] = Math.random(); dPos[i * 3 + 2] = Math.random(); dSeed[i] = Math.random(); }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
  dGeo.setAttribute('aColor', new THREE.BufferAttribute(dCol, 3));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthTest: false, depthWrite: false,
    uniforms: {uRes: {value: new THREE.Vector2(1, 1)}, uTime: {value: 0}, uScroll: {value: 0}, uVel: {value: 0}, uPR: {value: 1}, uOpacity: {value: .4}}
  });
  const dust = new THREE.Points(dGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
  function applyTheme() {
    const p = root.dataset.theme === 'dark' ? PAL.dark : PAL.light;
    for (let i = 0; i < N; i++) { tints.setHex(p.dust[i % 3]); dCol[i * 3] = tints.r; dCol[i * 3 + 1] = tints.g; dCol[i * 3 + 2] = tints.b; }
    dGeo.attributes.aColor.needsUpdate = true;
    dustMat.uniforms.uOpacity.value = p.opacity;
  }
  applyTheme();
  const themeObs = new MutationObserver(applyTheme);
  themeObs.observe(root, {attributes: true, attributeFilter: ['data-theme']});

  // ---- media planes --------------------------------------------------------------------------
  const geo = new THREE.PlaneGeometry(1, 1, 28, 28);
  const planes = new Map(); // img -> {mesh, tex, key, hover, hoverT, sweep, announced}

  function makeTexture(img, rect) {
    const svg = /\.svg(\?|#|$)/i.test(img.currentSrc || img.src);
    let w = svg ? rect.width * 2 : img.naturalWidth, h = svg ? rect.height * 2 : img.naturalHeight;
    if (!w || !h) return null;
    const k = Math.min(1, MAX_TEX / Math.max(w, h));
    w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));
    const own = document.createElement('canvas'); own.width = w; own.height = h;
    own.getContext('2d').drawImage(img, 0, 0, w, h); // same-origin: never taints
    const tex = new THREE.CanvasTexture(own);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 4;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
    return {tex, w, h};
  }
  function dropPlane(img) {
    const p = planes.get(img);
    if (!p) return;
    scene.remove(p.mesh); p.mesh.material.dispose(); p.tex.dispose();
    img.classList.remove('gl-on');
    if (p.enter) { p.host.removeEventListener('mouseenter', p.enter); p.host.removeEventListener('mouseleave', p.leave); }
    planes.delete(img);
  }
  function eligible(img) {
    if (img.closest(SKIP)) return null;
    const r = img.getBoundingClientRect();
    return r.width >= MIN && r.height >= MIN * .6 ? r : null;
  }
  function addPlane(img, rect) {
    const made = makeTexture(img, rect);
    if (!made) return;
    const mat = new THREE.ShaderMaterial({
      vertexShader: MEDIA_VS, fragmentShader: MEDIA_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {uTex: {value: made.tex}, uSize: {value: new THREE.Vector2(1, 1)}, uImg: {value: new THREE.Vector2(made.w, made.h)},
        uP: {value: 0}, uVel: {value: 0}, uTime: {value: 0}, uHover: {value: 0}, uSweep: {value: 0}}
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 1;
    scene.add(mesh);
    const host = img.closest('.card,.article,figure,.visual,.image') || img;
    const p = {mesh, tex: made.tex, key: img.currentSrc || img.src, hover: 0, hoverT: 0, sweep: 0, announced: false, host};
    p.enter = () => { p.hoverT = 1; if (p.sweep >= 1 || p.sweep === 0) p.sweep = .001; };
    p.leave = () => { p.hoverT = 0; };
    host.addEventListener('mouseenter', p.enter); host.addEventListener('mouseleave', p.leave);
    planes.set(img, p);
  }
  // Cards come from a database and can be re-rendered or filtered: rescan, then add/refresh/drop planes.
  function scan() {
    for (const [img, p] of planes) {
      if (!img.isConnected || (img.currentSrc || img.src) !== p.key) dropPlane(img);
    }
    document.querySelectorAll(IMG_SEL).forEach(img => {
      if (planes.has(img) || !img.complete || !img.naturalWidth && !/\.svg/i.test(img.currentSrc || img.src)) return;
      const r = eligible(img);
      if (r) { try { addPlane(img, r); } catch (e) { console.warn('[pf] plane', e); } }
    });
  }

  // ---- sizing, loop --------------------------------------------------------------------------
  const resize = () => {
    W = Math.max(1, innerWidth); H = Math.max(1, innerHeight);
    const pr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    camera.right = W; camera.top = H; camera.updateProjectionMatrix();
    dustMat.uniforms.uRes.value.set(W, H); dustMat.uniforms.uPR.value = pr;
  };
  addEventListener('resize', resize); resize();

  let last = performance.now(), t = 0, prevY = pf.scroll || 0, scrollAcc = 0, vel = 0, errors = 0, disposed = false;
  let scanTimer = setInterval(scan, 600);
  const target = document.querySelector('main') || document.body;
  const mo = new MutationObserver(() => { clearTimeout(mo.t); mo.t = setTimeout(scan, 120); });
  mo.observe(target, {childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'hidden', 'class']});
  const onLoad = () => scan();
  addEventListener('load', onLoad);

  function tick(now) {
    if (disposed) return;
    if (document.hidden) { last = now; return; }
    try {
      const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now; t += dt;
      const y = pf.scroll || 0, dy = y - prevY; prevY = y;
      scrollAcc += dy;
      vel += (cl(dy / dt / 2500, -1, 1) - vel) * (1 - Math.exp(-dt * 8));
      const u = dustMat.uniforms;
      u.uTime.value = t; u.uScroll.value = scrollAcc; u.uVel.value = vel;
      const vh = innerHeight;
      for (const [img, p] of planes) {
        const r = img.getBoundingClientRect();
        const show = r.width > 8 && r.height > 8 && r.bottom > -100 && r.top < vh + 100;
        p.mesh.visible = show;
        if (!show) continue;
        p.mesh.scale.set(r.width, r.height, 1);
        p.mesh.position.set(r.left + r.width / 2, vh - (r.top + r.height / 2), 0);
        p.hover += (p.hoverT - p.hover) * (1 - Math.exp(-dt * 6));
        if (p.sweep > 0 && p.sweep < 1) p.sweep = Math.min(1, p.sweep + dt * 1.1);
        else if (p.sweep >= 1 && !p.hoverT && p.hover < .02) p.sweep = 0;
        const e = cl((vh - r.top) / (vh * .6));
        const m = p.mesh.material.uniforms;
        m.uSize.value.set(r.width, r.height);
        m.uP.value = 1 - Math.pow(1 - e, 3);
        m.uVel.value = vel; m.uTime.value = t; m.uHover.value = p.hover; m.uSweep.value = p.sweep;
      }
      renderer.render(scene, camera);
      // Swap DOM img -> plane only after the plane has drawn once, so there is never a blank frame.
      for (const [img, p] of planes) if (!p.announced && p.mesh.visible) { p.announced = true; img.classList.add('gl-on'); }
    } catch (e) {
      if (++errors > 3) { console.warn('[pf] webgl', e); teardown(); root.classList.remove('gl-media'); document.querySelectorAll('img.gl-on').forEach(i => i.classList.remove('gl-on')); canvas.remove(); }
    }
  }
  function teardown() {
    if (disposed) return;
    disposed = true;
    clearInterval(scanTimer); mo.disconnect(); themeObs.disconnect();
    removeEventListener('resize', resize); removeEventListener('load', onLoad);
    for (const img of [...planes.keys()]) dropPlane(img);
    geo.dispose(); dGeo.dispose(); dustMat.dispose(); renderer.dispose();
  }
  addEventListener('pagehide', teardown);
  pf.add(tick);
  scan();
  tick(performance.now());
  return true;
}
