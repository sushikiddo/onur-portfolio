import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createGlowSpriteTexture, createWalnutTextures } from './textures.js'

export class CozyRoom
{
    constructor(scene, textureLoader)
    {
        this.scene = scene
        this.loader = textureLoader
        this.dustPoints = null
        this.neonMats = []
        this.pcFanPivot = null

        this._buildWallsAndFloor()
        this._buildAcousticSlats()
        this._buildPanoramicWindow()
        this._buildWallShelfAndFrames()
        this._buildStudioSign()
        this._buildBackLedStrip()
        this._buildUnderDeskPc()
        this._buildDustMotes()
    }

    _buildWallsAndFloor()
    {
        // Warm dark parquet floor far beneath the expanded L-desk
        const { map: floorMap, bumpMap: floorBump } = createWalnutTextures(8, 8)
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(46, 46),
            new THREE.MeshStandardMaterial({
                color: 0x3b2d26,
                map: floorMap,
                bumpMap: floorBump,
                bumpScale: 0.012,
                roughness: 0.82,
            })
        )
        floor.rotation.x = -Math.PI * 0.5
        floor.position.y = -4.5
        floor.receiveShadow = true
        this.scene.add(floor)

        // Cozy textured studio area rug
        const rug = new THREE.Mesh(
            new RoundedBoxGeometry(19, 0.04, 13, 2, 0.015),
            new THREE.MeshStandardMaterial({ color: 0x242033, roughness: 0.96 })
        )
        rug.position.set(1.2, -4.48, 1.5)
        rug.receiveShadow = true
        this.scene.add(rug)

        // Enclosed cozy studio corner: back wall, left wall, and right wall wrapping the L-desk
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x171a26, roughness: 0.92 })
        this.backWall = new THREE.Mesh(new THREE.PlaneGeometry(42, 18), wallMat)
        this.backWall.position.set(1.0, 3.8, -4.65)
        this.backWall.receiveShadow = true
        this.scene.add(this.backWall)

        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), wallMat)
        leftWall.rotation.y = Math.PI * 0.5
        leftWall.position.set(-10.4, 3.8, 3.5)
        leftWall.receiveShadow = true
        this.scene.add(leftWall)

        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), wallMat)
        rightWall.rotation.y = -Math.PI * 0.5
        rightWall.position.set(10.6, 3.8, 3.5)
        rightWall.receiveShadow = true
        this.scene.add(rightWall)

        // Baseboard trims
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x262435, roughness: 0.72 })
        const backTrim = new THREE.Mesh(new THREE.BoxGeometry(42, 0.36, 0.14), trimMat)
        backTrim.position.set(1.0, -4.32, -4.58)
        this.scene.add(backTrim)
    }

    _buildAcousticSlats()
    {
        // Wide walnut vertical acoustic panel behind the main desk area
        const backing = new THREE.Mesh(
            new THREE.BoxGeometry(8.8, 6.2, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x0e1017, roughness: 0.96 })
        )
        backing.position.set(-1.6, 2.5, -4.6)
        this.scene.add(backing)

        const slatGeo = new RoundedBoxGeometry(0.16, 6.1, 0.13, 2, 0.022)
        const slatMat = new THREE.MeshStandardMaterial({ color: 0x6b452b, roughness: 0.58, metalness: 0.04 })
        for(let i = 0; i < 31; i++)
        {
            const slat = new THREE.Mesh(slatGeo, slatMat)
            slat.position.set(-5.8 + i * 0.28, 2.5, -4.52)
            slat.castShadow = true
            slat.receiveShadow = true
            this.scene.add(slat)
        }
    }

    _buildPanoramicWindow()
    {
        // Wide Antalya Beydağları & Mediterranean Sea panoramic window on right-back wall
        this.windowCanvas = document.createElement('canvas')
        this.windowCanvas.width = 768
        this.windowCanvas.height = 420
        this.windowTex = new THREE.CanvasTexture(this.windowCanvas)
        this.windowTex.colorSpace = THREE.SRGBColorSpace

        const pane = new THREE.Mesh(
            new THREE.PlaneGeometry(6.8, 3.7),
            new THREE.MeshBasicMaterial({ map: this.windowTex })
        )
        pane.position.set(6.35, 3.25, -4.55)
        this.scene.add(pane)

        // Subtle reflective glass layer in front of sky
        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(6.75, 3.65),
            new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.08,
                roughness: 0.08,
                metalness: 0.1,
                reflectivity: 0.9,
            })
        )
        glass.position.set(6.35, 3.25, -4.48)
        this.scene.add(glass)

        // Ambient window light pouring onto the right side of the desk
        this.windowLight = new THREE.PointLight(0xfb923c, 2.4, 15, 1.4)
        this.windowLight.position.set(6.2, 3.1, -3.2)
        this.scene.add(this.windowLight)

        // Anodized dark aluminum frame + deep windowsill
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d202d, roughness: 0.42, metalness: 0.48 })
        const bars = [
            [7.1, 0.18, 0.24, 6.35, 5.15, -4.48],
            [7.2, 0.20, 0.48, 6.35, 1.35, -4.36],
            [0.18, 3.9, 0.24, 2.88, 3.25, -4.48],
            [0.18, 3.9, 0.24, 9.82, 3.25, -4.48],
            [0.10, 3.75, 0.16, 6.35, 3.25, -4.46],
        ]
        for(const [w, h, d, x, y, z] of bars)
        {
            const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.025), frameMat)
            b.position.set(x, y, z)
            b.castShadow = true
            b.receiveShadow = true
            this.scene.add(b)
        }
    }

    drawWindowSky(mode, elapsed = 0)
    {
        const ctx = this.windowCanvas.getContext('2d')
        const w = 768
        const h = 420
        const g = ctx.createLinearGradient(0, 0, 0, h)
        if(mode === 'day')
        {
            g.addColorStop(0.0, '#0284c7')
            g.addColorStop(0.55, '#7dd3fc')
            g.addColorStop(1.0, '#fef3c7')
            this.windowLight.color.setHex(0xc8ecff)
            this.windowLight.intensity = 3.0
        }
        else if(mode === 'night')
        {
            g.addColorStop(0.0, '#040714')
            g.addColorStop(0.58, '#101a38')
            g.addColorStop(1.0, '#24264a')
            this.windowLight.color.setHex(0x6366f1)
            this.windowLight.intensity = 1.9
        }
        else
        {
            g.addColorStop(0.0, '#1b1846')
            g.addColorStop(0.36, '#6e2356')
            g.addColorStop(0.72, '#e25c22')
            g.addColorStop(1.0, '#fcd34d')
            this.windowLight.color.setHex(0xfb923c)
            this.windowLight.intensity = 2.6
        }
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)

        // Sun / crescent moon
        ctx.fillStyle = mode === 'night' ? '#fef9c3' : '#fffbeb'
        ctx.beginPath()
        ctx.arc(570, mode === 'day' ? 94 : 142, mode === 'night' ? 28 : 42, 0, Math.PI * 2)
        ctx.fill()
        if(mode === 'night')
        {
            ctx.fillStyle = '#0c132b'
            ctx.beginPath()
            ctx.arc(582, 134, 26, 0, Math.PI * 2)
            ctx.fill()
        }

        // Twinkling stars
        if(mode !== 'day')
        {
            ctx.fillStyle = '#ffffff'
            for(let i = 0; i < 60; i++)
            {
                const sx = (i * 131 + 29) % (w - 24) + 12
                const sy = (i * 59 + 15) % 195 + 10
                ctx.globalAlpha = 0.38 + 0.62 * Math.abs(Math.sin(elapsed * 1.3 + i))
                const s = i % 5 === 0 ? 3 : 2
                ctx.fillRect(sx, sy, s, s)
            }
            ctx.globalAlpha = 1
        }

        // Layered soft clouds
        ctx.fillStyle = mode === 'night' ? 'rgba(148, 163, 184, 0.14)' : 'rgba(255, 245, 232, 0.30)'
        for(let i = 0; i < 4; i++)
        {
            const cx = ((elapsed * (5 + i) + i * 220) % (w + 180)) - 90
            const cy = 72 + i * 38
            ctx.beginPath()
            ctx.roundRect(cx, cy, 135 - i * 10, 24, 12)
            ctx.fill()
        }

        // Distant & near Antalya Beydağları mountain ridges
        ctx.fillStyle = mode === 'day' ? '#274d7a' : '#181c36'
        ctx.beginPath()
        ctx.moveTo(0, h)
        ctx.lineTo(0, 275)
        ctx.lineTo(130, 224)
        ctx.lineTo(270, 256)
        ctx.lineTo(410, 210)
        ctx.lineTo(560, 248)
        ctx.lineTo(680, 226)
        ctx.lineTo(w, 252)
        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = mode === 'day' ? '#1a3658' : '#101324'
        ctx.beginPath()
        ctx.moveTo(0, h)
        ctx.lineTo(0, 305)
        ctx.lineTo(110, 268)
        ctx.lineTo(230, 294)
        ctx.lineTo(360, 262)
        ctx.lineTo(490, 292)
        ctx.lineTo(640, 270)
        ctx.lineTo(w, 292)
        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fill()

        // Mediterranean Sea + shimmering water reflection
        ctx.fillStyle = mode === 'day' ? '#0369a1' : '#090e1f'
        ctx.fillRect(0, 336, w, 84)
        ctx.fillStyle = mode === 'night' ? 'rgba(254, 249, 195, 0.32)' : 'rgba(253, 224, 71, 0.42)'
        for(let i = 0; i < 7; i++)
        {
            const wobble = Math.sin(elapsed * 2 + i) * 4
            ctx.fillRect(520 - i * 6 + wobble, 346 + i * 10, 86 - i * 9, 3)
        }

        this.windowTex.needsUpdate = true
    }

    _buildWallShelfAndFrames()
    {
        // Floating walnut gallery shelf centered above the dual monitors
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5c3a25, roughness: 0.52 })
        const shelf = new THREE.Mesh(new RoundedBoxGeometry(6.8, 0.16, 0.72, 3, 0.022), shelfMat)
        shelf.position.set(-1.55, 4.45, -4.18)
        shelf.castShadow = true
        shelf.receiveShadow = true
        this.scene.add(shelf)

        // Subtle warm under-shelf accent strip (balanced below bloom blowout)
        const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 0.9, 0.42) })
        const shelfLed = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.03, 0.04), ledMat)
        shelfLed.position.set(-1.55, 4.35, -4.42)
        this.scene.add(shelfLed)
        this.neonMats.push(ledMat)

        // Framed real portfolio artworks (using local public/img assets — zero 404s!)
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1c28, roughness: 0.42, metalness: 0.32 })
        const artSpecs = [
            { x: -3.75, w: 1.25, h: 0.88, url: '/assets/img/real/komur.jpg' },
            { x: -2.15, w: 1.25, h: 0.88, url: '/assets/img/grafik-animasyon/p1-sonrasi.webp' },
            { x: -0.55, w: 1.25, h: 0.88, url: '/assets/img/grafik-animasyon/p4-sonrasi.webp' },
            { x:  0.85, w: 0.82, h: 1.00, url: '/assets/img/onur-portrait.jpg' },
        ]
        for(const spec of artSpecs)
        {
            const g = new THREE.Group()
            g.position.set(spec.x, 4.53 + spec.h * 0.5, -4.28)
            g.rotation.x = -0.07

            const f = new THREE.Mesh(new RoundedBoxGeometry(spec.w + 0.1, spec.h + 0.1, 0.07, 2, 0.015), frameMat)
            f.castShadow = true
            g.add(f)

            const mat = new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.58 })
            this.loader.load(spec.url, (tex) =>
            {
                tex.colorSpace = THREE.SRGBColorSpace
                mat.map = tex
                mat.color.setHex(0xffffff)
                mat.needsUpdate = true
            })
            const pic = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), mat)
            pic.position.z = 0.04
            g.add(pic)
            this.scene.add(g)
        }

        // Trailing potted pothos plant on the shelf edge
        const pot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.20, 0.15, 0.30, 16),
            new THREE.MeshStandardMaterial({ color: 0xc96c49, roughness: 0.72 })
        )
        pot.position.set(1.62, 4.68, -4.10)
        pot.castShadow = true
        this.scene.add(pot)

        const vineMat = new THREE.MeshStandardMaterial({ color: 0x2b9e59, roughness: 0.65 })
        for(let i = 0; i < 9; i++)
        {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), vineMat)
            leaf.scale.set(1.2, 0.5, 0.9)
            leaf.position.set(
                1.62 + Math.cos(i * 1.1) * 0.16,
                4.80 - i * 0.11,
                -3.92 + Math.sin(i * 0.8) * 0.12
            )
            leaf.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.4
            this.scene.add(leaf)
        }
    }

    _buildStudioSign()
    {
        // Positioned on left wall well clear of the top-left HUD pill!
        const c = document.createElement('canvas')
        c.width = 512
        c.height = 148
        const ctx = c.getContext('2d')
        ctx.clearRect(0, 0, 512, 148)
        ctx.strokeStyle = '#f59e42'
        ctx.lineWidth = 5
        ctx.shadowColor = '#f59e42'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.roundRect(14, 14, 484, 120, 26)
        ctx.stroke()
        ctx.fillStyle = '#fef3c7'
        ctx.font = '700 54px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('ONUR · STUDIO', 256, 76)

        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(3.1, 0.9),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        )
        sign.position.set(-7.65, 2.75, -4.52)
        this.scene.add(sign)
    }

    _buildBackLedStrip()
    {
        // Warm soft bias-lighting strip behind desk (calibrated so it never blows out into white glare)
        const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.72, 0.28) })
        const strip = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.045, 0.04), stripMat)
        strip.position.set(0.0, -0.02, -4.25)
        this.scene.add(strip)
        this.neonMats.push(stripMat)
    }

    _buildUnderDeskPc()
    {
        // Sleek tempered-glass PC tower under the right side of the desk
        const pc = new THREE.Group()
        pc.position.set(6.8, -3.1, -1.6)
        pc.rotation.y = -0.18

        const caseMat = new THREE.MeshStandardMaterial({ color: 0x161822, roughness: 0.35, metalness: 0.65 })
        const body = new THREE.Mesh(new RoundedBoxGeometry(1.15, 2.35, 2.1, 3, 0.05), caseMat)
        body.castShadow = true
        body.receiveShadow = true
        pc.add(body)

        const fanRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.85, 0.32) })
        for(let i = 0; i < 3; i++)
        {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 22), fanRingMat)
            ring.position.set(0, -0.58 + i * 0.58, 1.07)
            pc.add(ring)
        }
        this.scene.add(pc)
    }

    _buildDustMotes()
    {
        const count = 44
        const pos = new Float32Array(count * 3)
        this.dustBase = []
        for(let i = 0; i < count; i++)
        {
            const x = (Math.random() - 0.45) * 18
            const y = 0.4 + Math.random() * 4.4
            const z = -3.4 + Math.random() * 9.5
            pos[i * 3] = x
            pos[i * 3 + 1] = y
            pos[i * 3 + 2] = z
            this.dustBase.push({ x, y, z, phase: Math.random() * Math.PI * 2 })
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        const mat = new THREE.PointsMaterial({
            map: createGlowSpriteTexture('#ffe6b3', 'rgba(255,220,160,0)'),
            size: 0.13,
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        })
        this.dustPoints = new THREE.Points(geo, mat)
        this.scene.add(this.dustPoints)
    }

    update(dt, elapsed, lampMode)
    {
        if(!this._lastSkyDraw || elapsed - this._lastSkyDraw > 0.35 || this._lastSkyMode !== lampMode)
        {
            this._lastSkyDraw = elapsed
            this._lastSkyMode = lampMode
            this.drawWindowSky(lampMode, elapsed)
        }

        if(this.dustPoints)
        {
            const arr = this.dustPoints.geometry.attributes.position.array
            for(let i = 0; i < this.dustBase.length; i++)
            {
                const b = this.dustBase[i]
                arr[i * 3] = b.x + Math.sin(elapsed * 0.32 + b.phase) * 0.25
                arr[i * 3 + 1] = b.y + Math.sin(elapsed * 0.48 + b.phase * 1.4) * 0.16
                arr[i * 3 + 2] = b.z + Math.cos(elapsed * 0.28 + b.phase) * 0.20
            }
            this.dustPoints.geometry.attributes.position.needsUpdate = true
            this.dustPoints.material.opacity = lampMode === 'day' ? 0.26 : 0.48
        }
    }
}
