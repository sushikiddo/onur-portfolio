import * as THREE from 'three'

// High-resolution 1024x1024 realistic walnut wood PBR texture set (albedo + bump + roughness)
export function createWalnutTextures(repeatX = 3.2, repeatY = 2.0)
{
    const size = 1024
    const colorCanvas = document.createElement('canvas')
    colorCanvas.width = size
    colorCanvas.height = size
    const cctx = colorCanvas.getContext('2d')

    const bumpCanvas = document.createElement('canvas')
    bumpCanvas.width = size
    bumpCanvas.height = size
    const bctx = bumpCanvas.getContext('2d')

    const roughCanvas = document.createElement('canvas')
    roughCanvas.width = size
    roughCanvas.height = size
    const rctx = roughCanvas.getContext('2d')

    // Rich American walnut base
    const grad = cctx.createLinearGradient(0, 0, size, 0)
    grad.addColorStop(0.0, '#4f311f')
    grad.addColorStop(0.28, '#5f3c26')
    grad.addColorStop(0.55, '#472b1a')
    grad.addColorStop(0.82, '#5a3823')
    grad.addColorStop(1.0, '#4d301e')
    cctx.fillStyle = grad
    cctx.fillRect(0, 0, size, size)

    bctx.fillStyle = '#808080'
    bctx.fillRect(0, 0, size, size)

    rctx.fillStyle = '#7c7c7c'
    rctx.fillRect(0, 0, size, size)

    // Layered organic grain fibers & cathedral rings
    for(let y = 0; y < size; y += 2)
    {
        const plank = Math.floor(y / 256)
        const offset = plank * 37.5
        const wave = Math.sin((y + offset) * 0.028) * 26 + Math.sin((y + offset) * 0.009) * 14
        const dark = (Math.sin(y * 0.085 + wave * 0.14) + Math.sin(y * 0.23 + wave * 0.06) * 0.4 + 1.4) / 2.8

        cctx.fillStyle = dark > 0.52
            ? `rgba(26, 13, 6, ${0.14 + (dark - 0.5) * 0.30})`
            : `rgba(148, 98, 62, ${0.06 + (0.52 - dark) * 0.18})`
        cctx.fillRect(0, y, size, 2)

        const bv = Math.floor(96 + dark * 64)
        bctx.fillStyle = `rgb(${bv},${bv},${bv})`
        bctx.fillRect(0, y, size, 2)

        // Darker pores are slightly rougher, polished heartwood is satin-smooth
        const rv = Math.floor(92 + dark * 78)
        rctx.fillStyle = `rgb(${rv},${rv},${rv})`
        rctx.fillRect(0, y, size, 2)
    }

    // Fine horizontal wood pores
    for(let i = 0; i < 900; i++)
    {
        const px = (i * 193) % size
        const py = (i * 317) % size
        const len = 18 + (i % 46)
        cctx.fillStyle = 'rgba(20, 10, 4, 0.22)'
        cctx.fillRect(px, py, len, 1.5)
        bctx.fillStyle = '#4a4a4a'
        bctx.fillRect(px, py, len, 1.5)
        rctx.fillStyle = '#bcbcbc'
        rctx.fillRect(px, py, len, 1.5)
    }

    // Subtle butt-jointed walnut plank seams
    for(const seamY of [256, 512, 768])
    {
        cctx.fillStyle = 'rgba(18, 9, 4, 0.42)'
        cctx.fillRect(0, seamY, size, 2)
        cctx.fillStyle = 'rgba(170, 120, 82, 0.12)'
        cctx.fillRect(0, seamY + 2, size, 1.5)
        bctx.fillStyle = '#242424'
        bctx.fillRect(0, seamY, size, 2.5)
        rctx.fillStyle = '#d8d8d8'
        rctx.fillRect(0, seamY, size, 3)
    }

    const setup = (canvas, isColor = false) =>
    {
        const tex = new THREE.CanvasTexture(canvas)
        if(isColor) tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(repeatX, repeatY)
        tex.anisotropy = 8
        return tex
    }

    return {
        map: setup(colorCanvas, true),
        bumpMap: setup(bumpCanvas, false),
        roughnessMap: setup(roughCanvas, false),
    }
}

// High-resolution stitched leather desk mat PBR textures
export function createDeskMatTextures()
{
    const w = 1024
    const h = 512
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')

    const b = document.createElement('canvas')
    b.width = w
    b.height = h
    const bctx = b.getContext('2d')

    const baseGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, 40, w * 0.5, h * 0.5, w * 0.65)
    baseGrad.addColorStop(0, '#1e2230')
    baseGrad.addColorStop(1, '#141722')
    ctx.fillStyle = baseGrad
    ctx.fillRect(0, 0, w, h)

    bctx.fillStyle = '#808080'
    bctx.fillRect(0, 0, w, h)

    // Pebble leather micro-grain
    for(let y = 0; y < h; y += 4)
    {
        for(let x = (y % 8 === 0 ? 0 : 2); x < w; x += 6)
        {
            const n = ((x * 37 + y * 91) % 23) / 23
            ctx.fillStyle = n > 0.5 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.045)'
            ctx.fillRect(x, y, 3, 3)
            const gv = Math.floor(114 + n * 32)
            bctx.fillStyle = `rgb(${gv},${gv},${gv})`
            bctx.fillRect(x, y, 3, 3)
        }
    }

    // Crisp warm amber saddle-stitch border
    ctx.strokeStyle = 'rgba(245, 158, 66, 0.58)'
    ctx.lineWidth = 4
    ctx.setLineDash([14, 10])
    ctx.strokeRect(20, 20, w - 40, h - 40)

    bctx.strokeStyle = '#d4d4d4'
    bctx.lineWidth = 5
    bctx.setLineDash([14, 10])
    bctx.strokeRect(20, 20, w - 40, h - 40)

    // Embossed corner monogram
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(245, 158, 66, 0.34)'
    ctx.font = '700 26px monospace'
    ctx.fillText('ONUR · ANTALYA', w - 285, h - 38)

    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8

    const bumpMap = new THREE.CanvasTexture(b)
    bumpMap.anisotropy = 8

    return { map, bumpMap }
}

// Procedural directional short-hair cat fur bump & roughness maps for Kömür!
export function createFurTextures()
{
    const size = 512
    const bCanvas = document.createElement('canvas')
    bCanvas.width = size
    bCanvas.height = size
    const bctx = bCanvas.getContext('2d')

    const rCanvas = document.createElement('canvas')
    rCanvas.width = size
    rCanvas.height = size
    const rctx = rCanvas.getContext('2d')

    bctx.fillStyle = '#787878'
    bctx.fillRect(0, 0, size, size)
    rctx.fillStyle = '#a8a8a8'
    rctx.fillRect(0, 0, size, size)

    // Thousands of fine directional fur strands
    for(let i = 0; i < 6500; i++)
    {
        const x = (i * 197 + (i % 13) * 29) % size
        const y = (i * 313 + (i % 17) * 19) % size
        const len = 10 + (i % 14)
        const tilt = ((i % 7) - 3) * 0.45
        const bright = 92 + (i % 120)

        bctx.strokeStyle = `rgb(${bright},${bright},${bright})`
        bctx.lineWidth = 1.25
        bctx.beginPath()
        bctx.moveTo(x, y)
        bctx.lineTo(x + tilt, y + len)
        bctx.stroke()

        const rough = 135 + (i % 70)
        rctx.strokeStyle = `rgb(${rough},${rough},${rough})`
        rctx.lineWidth = 1.3
        rctx.beginPath()
        rctx.moveTo(x, y)
        rctx.lineTo(x + tilt, y + len)
        rctx.stroke()
    }

    const bumpMap = new THREE.CanvasTexture(bCanvas)
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping
    bumpMap.repeat.set(3, 3)

    const roughnessMap = new THREE.CanvasTexture(rCanvas)
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping
    roughnessMap.repeat.set(3, 3)

    return { bumpMap, roughnessMap }
}

// Photorealistic chartreuse-gold cat eye matching website Kömür v2.4.0 (#737b16 -> #e8e348 -> #f4f182)
export function createKomurEyeTexture()
{
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#090c12'
    ctx.fillRect(0, 0, size, size)

    const cx = size * 0.5
    const cy = size * 0.5
    const irisR = size * 0.30

    // Outer dark eyelid contour
    ctx.beginPath()
    ctx.arc(cx, cy, irisR + 10, 0, Math.PI * 2)
    ctx.fillStyle = '#05070b'
    ctx.fill()

    // Chartreuse-lime / golden-green cat iris
    const irisGrad = ctx.createRadialGradient(cx, cy - 8, irisR * 0.2, cx, cy, irisR)
    irisGrad.addColorStop(0.0, '#f4f182')
    irisGrad.addColorStop(0.46, '#e8e348')
    irisGrad.addColorStop(0.76, '#b8c324')
    irisGrad.addColorStop(0.92, '#6f7817')
    irisGrad.addColorStop(1.0, '#2c320a')
    ctx.beginPath()
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2)
    ctx.fillStyle = irisGrad
    ctx.fill()

    // Radial feline iris stroma fibers
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, irisR * 0.96, 0, Math.PI * 2)
    ctx.clip()
    for(let i = 0; i < 108; i++)
    {
        const a = (i / 108) * Math.PI * 2
        const inner = irisR * (0.28 + (i % 3) * 0.04)
        const outer = irisR * (0.88 + (i % 5) * 0.025)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
        ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 250, 175, 0.28)' : 'rgba(58, 65, 10, 0.30)'
        ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.4
        ctx.stroke()
    }
    // Natural upper eyelid soft shadow
    const lidShadow = ctx.createLinearGradient(0, cy - irisR, 0, cy - irisR * 0.1)
    lidShadow.addColorStop(0, 'rgba(6, 8, 12, 0.52)')
    lidShadow.addColorStop(1, 'rgba(6, 8, 12, 0)')
    ctx.fillStyle = lidShadow
    ctx.fillRect(cx - irisR, cy - irisR, irisR * 2, irisR)
    ctx.restore()

    // Expressive large vertical-almond feline pupil
    ctx.beginPath()
    ctx.ellipse(cx, cy + 2, irisR * 0.44, irisR * 0.62, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#05070c'
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(cx, cy + 2, irisR * 0.46, irisR * 0.64, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(244, 241, 130, 0.36)'
    ctx.lineWidth = 3
    ctx.stroke()

    // Signature dual wet catchlights (large upper-left + small lower-right)
    ctx.beginPath()
    ctx.ellipse(cx - irisR * 0.33, cy - irisR * 0.31, irisR * 0.18, irisR * 0.145, -0.35, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx + irisR * 0.26, cy + irisR * 0.28, irisR * 0.068, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.fill()

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
}

// Natural granular corkboard PBR textures
export function createCorkTextures()
{
    const size = 512
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')

    const b = document.createElement('canvas')
    b.width = size
    b.height = size
    const bctx = b.getContext('2d')

    ctx.fillStyle = '#a87648'
    ctx.fillRect(0, 0, size, size)
    bctx.fillStyle = '#808080'
    bctx.fillRect(0, 0, size, size)

    const palette = ['#96643a', '#b68352', '#82542e', '#c29060', '#754a28']
    for(let i = 0; i < 4200; i++)
    {
        const x = (i * 173 + (i % 29) * 17) % size
        const y = (i * 263 + (i % 19) * 23) % size
        const r = 2 + (i % 5)
        ctx.fillStyle = palette[i % palette.length]
        ctx.fillRect(x, y, r, r * 0.85)
        const v = 90 + (i % 85)
        bctx.fillStyle = `rgb(${v},${v},${v})`
        bctx.fillRect(x, y, r, r * 0.85)
    }

    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    const bumpMap = new THREE.CanvasTexture(b)
    return { map, bumpMap }
}

// Woven sisal rope PBR textures for the cat scratching post
export function createSisalTextures()
{
    const size = 256
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')

    const b = document.createElement('canvas')
    b.width = size
    b.height = size
    const bctx = b.getContext('2d')

    ctx.fillStyle = '#cdb082'
    ctx.fillRect(0, 0, size, size)
    bctx.fillStyle = '#808080'
    bctx.fillRect(0, 0, size, size)

    for(let y = 0; y < size; y += 12)
    {
        const g = ctx.createLinearGradient(0, y, 0, y + 12)
        g.addColorStop(0, '#8d6e43')
        g.addColorStop(0.35, '#dec293')
        g.addColorStop(0.72, '#c8a774')
        g.addColorStop(1, '#7a5d36')
        ctx.fillStyle = g
        ctx.fillRect(0, y, size, 12)

        const bg = bctx.createLinearGradient(0, y, 0, y + 12)
        bg.addColorStop(0, '#2a2a2a')
        bg.addColorStop(0.5, '#e8e8e8')
        bg.addColorStop(1, '#2a2a2a')
        bctx.fillStyle = bg
        bctx.fillRect(0, y, size, 12)
    }

    // Diagonal twine twist lines
    ctx.strokeStyle = 'rgba(72, 50, 24, 0.25)'
    ctx.lineWidth = 1.5
    for(let x = -size; x < size * 2; x += 10)
    {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x + 48, size)
        ctx.stroke()
    }

    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.set(2, 5)

    const bumpMap = new THREE.CanvasTexture(b)
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping
    bumpMap.repeat.set(2, 5)

    return { map, bumpMap }
}

// Soft radial dust/glow sprite
export function createGlowSpriteTexture(innerColor = '#ffd89a', outerColor = 'rgba(255, 190, 100, 0)')
{
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30)
    g.addColorStop(0, innerColor)
    g.addColorStop(0.4, innerColor)
    g.addColorStop(1, outerColor)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
}

// Soft vertical-fade volumetric lamp beam texture (eliminates hard cone edges!)
export function createLampBeamTexture()
{
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 256
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0.0, 'rgba(255, 212, 145, 0.34)')
    g.addColorStop(0.35, 'rgba(255, 198, 120, 0.14)')
    g.addColorStop(0.75, 'rgba(255, 185, 105, 0.04)')
    g.addColorStop(1.0, 'rgba(255, 180, 100, 0.0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
}

// Live scrolling code monitor texture (clean, modern Kömür v2.4.0 code)
export function createCodeMonitorTexture()
{
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 560
    const ctx = c.getContext('2d')
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4

    const lines = [
        ['#c084fc', 'import * as THREE from "three"'],
        ['#64748b', '// Kömür Studio Desk v3.0'],
        ['#38bdf8', 'const komur = new TuxedoCat({'],
        ['#dfe644', '  name: "Kömür",'],
        ['#dfe644', '  version: "2.4.0",'],
        ['#34d399', '  coat: "tuxedo-black",'],
        ['#34d399', '  eyes: "#e8e348",'],
        ['#fbbf24', '  paws: "white-socks",'],
        ['#38bdf8', '})'],
        ['#64748b', ''],
        ['#c084fc', 'export function animate(dt) {'],
        ['#f8fafc', '  komur.updateGait(dt)'],
        ['#f8fafc', '  komur.blinkAndPurr()'],
        ['#2dd4bf', '  pbr.renderShadows(scene)'],
        ['#c084fc', '}'],
        ['#64748b', ''],
        ['#fb7185', '// Antalya Sunset · 60fps'],
        ['#f8fafc', 'studio.lamp.setMode("evening")'],
        ['#34d399', 'status: "PURRING ✓"'],
    ]

    const draw = (scrollOffset = 0) =>
    {
        ctx.fillStyle = '#0b0f19'
        ctx.fillRect(0, 0, 320, 560)
        ctx.fillStyle = '#131929'
        ctx.fillRect(0, 0, 320, 34)
        ctx.fillStyle = '#94a3b8'
        ctx.font = '600 13px monospace'
        ctx.fillText('komur-studio.js — VS Code', 14, 22)

        ctx.font = '500 13.5px monospace'
        const shift = Math.floor(scrollOffset) % lines.length
        for(let i = 0; i < 20; i++)
        {
            const [col, txt] = lines[(i + shift) % lines.length]
            ctx.fillStyle = '#334155'
            ctx.fillText(String(i + 1).padStart(2, '0'), 12, 62 + i * 24)
            ctx.fillStyle = col
            ctx.fillText(txt, 40, 62 + i * 24)
        }
        tex.needsUpdate = true
    }

    draw(0)
    return { tex, draw }
}
