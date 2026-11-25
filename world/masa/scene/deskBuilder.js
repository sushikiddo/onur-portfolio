import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
    createCodeMonitorTexture,
    createCorkTextures,
    createDeskMatTextures,
    createFurTextures,
    createLampBeamTexture,
    createSisalTextures,
    createWalnutTextures,
} from './textures.js'

function rbox(w, h, d, mat, r = 0.03)
{
    const m = new THREE.Mesh(
        new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w * 0.25, h * 0.25, d * 0.25)),
        mat
    )
    m.castShadow = true
    m.receiveShadow = true
    return m
}

function tagStation(obj, stationId)
{
    obj.traverse((child) =>
    {
        if(child.isMesh) child.userData.stationId = stationId
    })
}

export class DeskScene
{
    constructor(scene, textureLoader)
    {
        this.scene = scene
        this.loader = textureLoader
        this.pushables = []
        this.platforms = []
        this.obstacles = []
        this.deskFloors = []
        this.steamPuffs = []
        this.rgbKeys = []
        this.postItGroup = new THREE.Group()
        this.clickTargets = []
        this.projects = []
        this.loadedImages = new Map()
        this.projectIndex = 0
        this.projectTimer = 0
        this.lang = 'tr'
        this.lampMode = 'evening'
        this.pendulumPivot = null

        this._buildLights()
        this._buildExpandedLDesk()
        this._buildDualMonitorsAndSpeakers()
        this._buildKeyboardAndMouse()
        this._buildDeskLamp()
        this._buildCorkboardBooksAndCatBed()
        this._buildSketchbookAndMug()
        this._buildBlogNotebook()
        this._buildKomurShowcaseStand()
        this._buildPhoneAndHeadphones()
        this._buildRightWingDesignAndCatTree()
        this._buildPushableProps()
        this.setLampMode('evening')
    }

    _buildLights()
    {
        this.hemi = new THREE.HemisphereLight(0xffe9cf, 0x1b1c2e, 0.72)
        this.scene.add(this.hemi)

        // Primary key directional light covering the entire expanded L-desk cleanly
        this.sun = new THREE.DirectionalLight(0xffbe80, 1.35)
        this.sun.position.set(-8, 12, 8)
        this.sun.castShadow = true
        this.sun.shadow.mapSize.set(2048, 2048)
        this.sun.shadow.camera.near = 1
        this.sun.shadow.camera.far = 36
        const d = 12.5
        this.sun.shadow.camera.left = -d
        this.sun.shadow.camera.right = d
        this.sun.shadow.camera.top = d
        this.sun.shadow.camera.bottom = -d
        this.sun.shadow.bias = -0.0004
        this.sun.shadow.normalBias = 0.025
        this.scene.add(this.sun)

        // Cool rim fill light from window side to sculpt Kömür's dark fur
        this.rim = new THREE.DirectionalLight(0x60a5fa, 0.48)
        this.rim.position.set(10, 7, -6)
        this.scene.add(this.rim)

        // Balanced architectural desk lamp spotlight (calibrated so white paper NEVER blows out!)
        this.lampLight = new THREE.SpotLight(0xffb866, 8.5, 13, Math.PI * 0.36, 0.68, 1.4)
        this.lampLight.position.set(-5.75, 2.75, -0.55)
        this.lampLight.target.position.set(-3.4, 0, 0.8)
        this.lampLight.castShadow = true
        this.lampLight.shadow.mapSize.set(1024, 1024)
        this.lampLight.shadow.bias = -0.0006
        this.lampLight.shadow.normalBias = 0.02
        this.scene.add(this.lampLight)
        this.scene.add(this.lampLight.target)

        // Subtle screen glow onto keyboard & Kömür's face
        this.monitorGlow = new THREE.PointLight(0x60a5fa, 1.25, 7.5, 1.5)
        this.monitorGlow.position.set(0, 1.85, -1.6)
        this.scene.add(this.monitorGlow)

        // Warm secondary accent light over right L-wing (design studio & cat tree)
        this.wingLight = new THREE.PointLight(0xffc98b, 1.6, 10, 1.4)
        this.wingLight.position.set(7.0, 3.2, 4.8)
        this.scene.add(this.wingLight)
    }

    _buildExpandedLDesk()
    {
        const { map, bumpMap, roughnessMap } = createWalnutTextures(3.6, 2.0)
        const woodMat = new THREE.MeshStandardMaterial({
            map,
            bumpMap,
            bumpScale: 0.016,
            roughnessMap,
            roughness: 0.62,
            metalness: 0.05,
        })
        this.woodMat = woodMat

        // 1. Main wide beveled walnut tabletop (16.4 x 7.8, top at y = 0)
        const mainTop = new THREE.Mesh(new RoundedBoxGeometry(16.4, 0.44, 7.8, 4, 0.06), woodMat)
        mainTop.position.set(0, -0.22, 0.1)
        mainTop.receiveShadow = true
        mainTop.castShadow = true
        mainTop.userData.isDeskFloor = true
        this.scene.add(mainTop)
        this.deskFloors.push(mainTop)

        // 2. Seamless Right L-Wing Extension (x: 4.2..9.4, z: 3.6..7.6) -> 2x larger exploration space!
        const { map: wMap, bumpMap: wBump, roughnessMap: wRough } = createWalnutTextures(1.8, 1.8)
        const wingWoodMat = new THREE.MeshStandardMaterial({
            map: wMap,
            bumpMap: wBump,
            bumpScale: 0.016,
            roughnessMap: wRough,
            roughness: 0.62,
            metalness: 0.05,
        })
        const wingTop = new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.44, 4.2, 4, 0.06), wingWoodMat)
        wingTop.position.set(6.8, -0.22, 5.5)
        wingTop.receiveShadow = true
        wingTop.castShadow = true
        wingTop.userData.isDeskFloor = true
        this.scene.add(wingTop)
        this.deskFloors.push(wingTop)

        // Sleek matte-black steel legs under the entire L-desk
        const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1c26, roughness: 0.38, metalness: 0.74 })
        for(const [lx, lz] of [[-7.4, -3.2], [7.4, -3.2], [-7.4, 3.4], [4.7, 7.1], [8.9, 7.1]])
        {
            const leg = rbox(0.30, 4.3, 0.30, legMat, 0.04)
            leg.position.set(lx, -2.45, lz)
            this.scene.add(leg)
        }

        // Large stitched dark pebble-leather desk mat
        const { map: matMap, bumpMap: matBump } = createDeskMatTextures()
        const deskMat = new THREE.Mesh(
            new RoundedBoxGeometry(9.0, 0.03, 4.15, 2, 0.012),
            new THREE.MeshStandardMaterial({
                map: matMap,
                bumpMap: matBump,
                bumpScale: 0.008,
                roughness: 0.84,
                metalness: 0.04,
            })
        )
        deskMat.position.set(0, 0.015, 0.38)
        deskMat.receiveShadow = true
        deskMat.userData.isDeskFloor = true
        this.scene.add(deskMat)
        this.deskFloors.push(deskMat)

        // Elevated walnut monitor riser shelf (jumpable platform!)
        const riser = rbox(5.2, 0.26, 1.25, woodMat, 0.03)
        riser.position.set(0, 0.13, -2.95)
        this.scene.add(riser)
        this.platforms.push({ minX: -2.6, maxX: 2.6, minZ: -3.58, maxZ: -2.32, y: 0.26 })
    }

    _buildDualMonitorsAndSpeakers()
    {
        const group = new THREE.Group()
        group.position.set(0, 0.26, -3.05)

        const metalMat = new THREE.MeshStandardMaterial({ color: 0x262a38, roughness: 0.30, metalness: 0.78 })
        const bezelMat = new THREE.MeshStandardMaterial({ color: 0x10121b, roughness: 0.36, metalness: 0.42 })

        // Main 4K Ultrawide Monitor
        const base = rbox(1.55, 0.07, 0.68, metalMat, 0.02)
        base.position.set(0, 0.035, 0.06)
        group.add(base)

        const neck = rbox(0.26, 0.96, 0.14, metalMat, 0.03)
        neck.position.set(0, 0.52, -0.08)
        group.add(neck)

        const frame = rbox(4.35, 2.34, 0.14, bezelMat, 0.04)
        frame.position.set(0, 1.72, 0)
        group.add(frame)

        // High-res Canvas Screen showing up-to-date projects (no bloom glare!)
        this.screenCanvas = document.createElement('canvas')
        this.screenCanvas.width = 960
        this.screenCanvas.height = 500
        this.screenTex = new THREE.CanvasTexture(this.screenCanvas)
        this.screenTex.colorSpace = THREE.SRGBColorSpace
        this.screenTex.anisotropy = 4
        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(4.12, 2.12),
            new THREE.MeshBasicMaterial({ map: this.screenTex })
        )
        screen.position.set(0, 1.72, 0.075)
        group.add(screen)

        // Post-it notes attached ONLY to outer bezel edges (NEVER covering screen text!)
        this.postItGroup.position.set(0, 1.72, 0.082)
        group.add(this.postItGroup)

        // Vertical Secondary Coding Monitor angled cleanly on the left
        const sideGroup = new THREE.Group()
        sideGroup.position.set(-2.95, 1.56, 0.34)
        sideGroup.rotation.y = 0.32
        const sideFrame = rbox(1.28, 2.16, 0.11, bezelMat, 0.035)
        sideGroup.add(sideFrame)

        this.codeMonitor = createCodeMonitorTexture()
        const sideScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(1.16, 2.02),
            new THREE.MeshBasicMaterial({ map: this.codeMonitor.tex })
        )
        sideScreen.position.z = 0.06
        sideGroup.add(sideScreen)

        const sideStand = rbox(0.16, 1.52, 0.14, metalMat, 0.02)
        sideStand.position.set(0, -0.76, -0.06)
        sideGroup.add(sideStand)
        group.add(sideGroup)

        tagStation(group, 'projects')
        this.scene.add(group)
        this.clickTargets.push(group)
        this._drawMonitorScreen()

        // Pair of Studio Reference Speakers flanking the monitors
        const spkBoxMat = new THREE.MeshStandardMaterial({ color: 0x171923, roughness: 0.46, metalness: 0.25 })
        const wooferMat = new THREE.MeshStandardMaterial({ color: 0x262938, roughness: 0.55, metalness: 0.35 })
        const coneRimMat = new THREE.MeshStandardMaterial({ color: 0xd99b43, roughness: 0.3, metalness: 0.78 })
        for(const [sx, ry] of [[-4.15, 0.25], [2.82, -0.18]])
        {
            const spk = new THREE.Group()
            spk.position.set(sx, 0, -2.95)
            spk.rotation.y = ry
            const cab = rbox(0.72, 1.18, 0.68, spkBoxMat, 0.04)
            cab.position.y = 0.59
            spk.add(cab)
            const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.05, 20), wooferMat)
            woofer.rotation.x = Math.PI * 0.5
            woofer.position.set(0, 0.42, 0.33)
            spk.add(woofer)
            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 10, 24), coneRimMat)
            rim.position.set(0, 0.42, 0.35)
            spk.add(rim)
            const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.04, 16), wooferMat)
            tweeter.rotation.x = Math.PI * 0.5
            tweeter.position.set(0, 0.86, 0.33)
            spk.add(tweeter)
            this.scene.add(spk)
            this.obstacles.push({ x: sx, z: -2.95, r: 0.46, maxY: 1.2 })
        }
    }

    setProjects(projects, lang = this.lang)
    {
        this.projects = projects || []
        this.lang = lang
        for(const p of this.projects)
        {
            if(p.image && !this.loadedImages.has(p.image))
            {
                const img = new Image()
                img.crossOrigin = 'anonymous'
                img.onload = () =>
                {
                    this.loadedImages.set(p.image, img)
                    this._drawMonitorScreen()
                }
                img.src = p.image
            }
        }
        this._drawMonitorScreen()
    }

    _drawMonitorScreen()
    {
        const ctx = this.screenCanvas.getContext('2d')
        const w = 960
        const h = 500

        const grad = ctx.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, '#0b101d')
        grad.addColorStop(1, '#18182b')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)

        // Sleek OS top bar
        ctx.fillStyle = '#141828'
        ctx.fillRect(0, 0, w, 40)
        for(const [i, col] of ['#fb7185', '#fbbf24', '#34d399'].entries())
        {
            ctx.fillStyle = col
            ctx.beginPath()
            ctx.arc(26 + i * 20, 20, 6, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.fillStyle = '#94a3b8'
        ctx.font = '600 14px monospace'
        ctx.fillText('onurcanorhan.pages.dev  ·  PORTFOLIO OS', 96, 25)

        const list = this.projects.length ? this.projects : [{
            title_tr: 'Kömür v2.4.0', title_en: 'Kömür v2.4.0',
            category_tr: 'macOS & Windows', category_en: 'macOS & Windows',
            tech_tr: 'Smokin Masaüstü Kedi · 4 Slot Gardırop', tech_en: 'Tuxedo Desktop Cat',
            image: '/assets/img/real/komur.jpg',
        }]
        const item = list[this.projectIndex % list.length]
        const en = this.lang === 'en'
        const title = en ? (item.title_en || item.title_tr) : (item.title_tr || item.title_en)
        const cat = en ? (item.category_en || item.category_tr) : (item.category_tr || item.category_en)
        const tech = en ? (item.tech_en || item.tech_tr) : (item.tech_tr || item.tech_en)

        // Left info column (plenty of left padding, zero post-it overlap!)
        ctx.fillStyle = 'rgba(223, 230, 68, 0.16)'
        ctx.beginPath()
        ctx.roundRect(42, 76, 215, 34, 17)
        ctx.fill()
        ctx.fillStyle = '#dfe644'
        ctx.font = '700 14px sans-serif'
        ctx.fillText((cat || 'PROJE').toUpperCase(), 58, 98)

        ctx.fillStyle = '#f8fafc'
        ctx.font = '800 36px sans-serif'
        ctx.fillText(String(title || ''), 42, 166, 392)

        ctx.fillStyle = '#2dd4bf'
        ctx.font = '600 16px monospace'
        ctx.fillText(String(tech || 'HTML · CSS · JS'), 42, 208, 392)

        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.beginPath()
        ctx.roundRect(42, 252, 380, 148, 16)
        ctx.fill()
        ctx.fillStyle = '#cbd5e1'
        ctx.font = '500 18px sans-serif'
        ctx.fillText(en ? 'Press [E] or click monitor' : 'Projeleri açmak için [E] bas', 64, 304)
        ctx.fillText(en ? 'to explore all projects' : 'veya monitöre tıkla', 64, 332)
        ctx.fillStyle = '#f59e42'
        ctx.font = '700 15px monospace'
        ctx.fillText(`0${(this.projectIndex % list.length) + 1} / 0${list.length}`, 64, 374)

        // Right real screenshot card
        const imgX = 456
        const imgY = 76
        const imgW = 462
        const imgH = 324
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(imgX, imgY, imgW, imgH, 16)
        ctx.clip()
        const realImg = item.image ? this.loadedImages.get(item.image) : null
        if(realImg)
        {
            ctx.drawImage(realImg, imgX, imgY, imgW, imgH)
        }
        else
        {
            const pg = ctx.createLinearGradient(imgX, imgY, imgX + imgW, imgY + imgH)
            pg.addColorStop(0, '#1e293b')
            pg.addColorStop(1, '#312e81')
            ctx.fillStyle = pg
            ctx.fillRect(imgX, imgY, imgW, imgH)
        }
        ctx.restore()
        ctx.strokeStyle = 'rgba(245, 158, 66, 0.50)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.roundRect(imgX, imgY, imgW, imgH, 16)
        ctx.stroke()

        // Bottom carousel dots
        for(let i = 0; i < list.length; i++)
        {
            ctx.fillStyle = i === (this.projectIndex % list.length) ? '#dfe644' : 'rgba(255,255,255,0.22)'
            ctx.beginPath()
            ctx.arc(456 + i * 24, 438, i === (this.projectIndex % list.length) ? 6 : 4, 0, Math.PI * 2)
            ctx.fill()
        }

        this.screenTex.needsUpdate = true
    }

    setWhispers(whispers)
    {
        while(this.postItGroup.children.length)
        {
            const child = this.postItGroup.children.pop()
            child.material?.map?.dispose?.()
            child.material?.dispose?.()
            child.geometry?.dispose?.()
        }

        // Mounted cleanly on the OUTER right & top bezel edges so screen text is 100% unobstructed!
        const slots = [
            [ 2.28,  0.76, -0.07],
            [ 2.28,  0.22,  0.06],
            [ 2.28, -0.32, -0.05],
            [-1.55,  1.24,  0.04],
            [-0.85,  1.24, -0.05],
            [ 1.35,  1.24,  0.05],
        ]
        const palette = ['#e8dc7c', '#e5b8ce', '#98dbe6', '#a8e2ba', '#eac296']
        const items = (whispers && whispers.length)
            ? whispers.slice(0, slots.length)
            : [
                { message: 'Merhaba Kömür! 🐾' },
                { message: 'Antalya · 2026' },
                { message: 'Post-it bırak!' },
            ]

        items.forEach((w, idx) =>
        {
            const [x, y, rot] = slots[idx]
            const c = document.createElement('canvas')
            c.width = 128
            c.height = 128
            const ctx = c.getContext('2d')
            ctx.fillStyle = palette[idx % palette.length]
            ctx.fillRect(0, 0, 128, 128)
            ctx.fillStyle = 'rgba(0,0,0,0.08)'
            ctx.fillRect(0, 0, 128, 16)
            ctx.fillStyle = '#1e2430'
            ctx.font = '700 17px sans-serif'
            const words = String(w.message || '').slice(0, 36).split(' ')
            let line = ''
            let ly = 44
            for(const word of words)
            {
                const test = line ? `${line} ${word}` : word
                if(ctx.measureText(test).width > 108 && line)
                {
                    ctx.fillText(line, 10, ly)
                    line = word
                    ly += 22
                }
                else
                {
                    line = test
                }
            }
            if(line) ctx.fillText(line, 10, ly)

            const tex = new THREE.CanvasTexture(c)
            tex.colorSpace = THREE.SRGBColorSpace
            const note = new THREE.Mesh(
                new THREE.PlaneGeometry(0.38, 0.38),
                new THREE.MeshStandardMaterial({ map: tex, roughness: 0.90 })
            )
            note.position.set(x, y, 0.0)
            note.rotation.z = rot
            this.postItGroup.add(note)
        })
    }

    _buildKeyboardAndMouse()
    {
        const kbGroup = new THREE.Group()
        kbGroup.position.set(0.05, 0.075, -0.82)

        const caseMat = new THREE.MeshStandardMaterial({ color: 0x191c28, roughness: 0.36, metalness: 0.58 })
        kbGroup.add(rbox(2.65, 0.11, 0.92, caseMat, 0.03))

        // Subtle warm underglow rim (balanced — never nuclear white)
        this.kbGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 0.68, 0.28) })
        const underglow = new THREE.Mesh(new THREE.BoxGeometry(2.70, 0.022, 0.96), this.kbGlowMat)
        underglow.position.y = -0.04
        kbGroup.add(underglow)

        const keyGeo = new RoundedBoxGeometry(0.13, 0.06, 0.13, 2, 0.015)
        for(let row = 0; row < 4; row++)
        {
            for(let col = 0; col < 14; col++)
            {
                const isAccent = (row === 0 && col === 0) || (row === 3 && col === 13)
                const mat = new THREE.MeshStandardMaterial({
                    color: isAccent ? 0xc27430 : 0x262b3d,
                    emissive: 0xf59e42,
                    emissiveIntensity: 0.22,
                    roughness: 0.45,
                })
                const key = new THREE.Mesh(keyGeo, mat)
                key.position.set(-1.10 + col * 0.17, 0.074, -0.25 + row * 0.17)
                kbGroup.add(key)
                this.rgbKeys.push({ mat, phase: col * 0.32 + row * 0.48 })
            }
        }
        this.scene.add(kbGroup)

        // Sculpted ergonomic mouse
        const mouseGroup = new THREE.Group()
        mouseGroup.position.set(2.1, 0.075, -0.78)
        const mouse = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.155, 0.21, 10, 16),
            new THREE.MeshStandardMaterial({ color: 0x1f2333, roughness: 0.28, metalness: 0.42 })
        )
        mouse.rotation.x = Math.PI * 0.5
        mouse.scale.set(1, 0.62, 1)
        mouse.castShadow = true
        mouseGroup.add(mouse)
        const wheel = new THREE.Mesh(
            new THREE.BoxGeometry(0.032, 0.04, 0.085),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.2, 1.05) })
        )
        wheel.position.set(0, 0.082, -0.08)
        mouseGroup.add(wheel)
        this.scene.add(mouseGroup)
    }

    _buildDeskLamp()
    {
        const group = new THREE.Group()
        group.position.set(-6.45, 0, -0.75)

        const metalMat = new THREE.MeshStandardMaterial({ color: 0x222532, roughness: 0.28, metalness: 0.82 })
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xd69a42, roughness: 0.26, metalness: 0.88 })
        const shadeMat = new THREE.MeshStandardMaterial({ color: 0xc8642e, roughness: 0.38, metalness: 0.28, side: THREE.DoubleSide })

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.12, 28), metalMat)
        base.position.y = 0.06
        base.castShadow = true
        base.receiveShadow = true
        group.add(base)

        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), brassMat)
        joint.position.set(0.26, 1.56, 0.06)
        group.add(joint)

        const arm1 = rbox(0.08, 1.66, 0.08, metalMat, 0.02)
        arm1.position.set(0.13, 0.84, 0.02)
        arm1.rotation.z = -0.16
        group.add(arm1)

        const arm2 = rbox(0.075, 1.38, 0.075, metalMat, 0.02)
        arm2.position.set(0.76, 2.04, 0.18)
        arm2.rotation.z = -0.85
        arm2.rotation.y = -0.18
        group.add(arm2)

        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.56, 28, 1, true), shadeMat)
        shade.position.set(1.26, 2.32, 0.28)
        shade.rotation.z = 0.45
        shade.castShadow = true
        group.add(shade)

        // Warm glowing bulb (subtle halo without harsh blowout)
        this.lampBulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.45, 0.72) })
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), this.lampBulbMat)
        bulb.position.set(1.2, 2.18, 0.28)
        group.add(bulb)

        // Soft gradient-faded volumetric light cone (zero hard bottom cut!)
        this.lampCone = new THREE.Mesh(
            new THREE.ConeGeometry(1.75, 2.35, 28, 1, true),
            new THREE.MeshBasicMaterial({
                map: createLampBeamTexture(),
                transparent: true,
                opacity: 0.42,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            })
        )
        this.lampCone.position.set(1.68, 1.12, 0.48)
        this.lampCone.rotation.z = 0.34
        group.add(this.lampCone)

        tagStation(group, 'lamp')
        this.scene.add(group)
        this.clickTargets.push(group)
        this.obstacles.push({ x: -6.45, z: -0.75, r: 0.58, maxY: 2.5 })
    }

    _buildCorkboardBooksAndCatBed()
    {
        // Realistic Corkboard (HAKKIMDA) with natural cork texture + pinned portrait & student card
        const group = new THREE.Group()
        group.position.set(-5.65, 1.35, -2.95)
        group.rotation.y = 0.24

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x674128, roughness: 0.56 })
        const { map: corkMap, bumpMap: corkBump } = createCorkTextures()
        const corkMat = new THREE.MeshStandardMaterial({ map: corkMap, bumpMap: corkBump, bumpScale: 0.015, roughness: 0.94 })

        group.add(rbox(2.3, 1.58, 0.11, frameMat, 0.03))
        const cork = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.38), corkMat)
        cork.position.z = 0.058
        cork.receiveShadow = true
        group.add(cork)

        // Pinned student card
        const cardCanvas = document.createElement('canvas')
        cardCanvas.width = 280
        cardCanvas.height = 180
        const ctx = cardCanvas.getContext('2d')
        ctx.fillStyle = '#e7dfd0'
        ctx.fillRect(0, 0, 280, 180)
        ctx.fillStyle = '#d98632'
        ctx.fillRect(0, 0, 280, 40)
        ctx.fillStyle = '#18181b'
        ctx.font = '800 19px sans-serif'
        ctx.fillText('ONUR CAN ORHAN', 16, 26)
        ctx.font = '700 15px sans-serif'
        ctx.fillText('Akdeniz Üniversitesi', 16, 72)
        ctx.fillStyle = '#334155'
        ctx.fillText('Bilgisayar Programcılığı', 16, 98)
        ctx.fillText('Antalya · Python / Web / 3D', 16, 126)
        ctx.fillStyle = '#14b8a6'
        ctx.fillRect(16, 146, 190, 10)

        const cardTex = new THREE.CanvasTexture(cardCanvas)
        cardTex.colorSpace = THREE.SRGBColorSpace
        const card = new THREE.Mesh(
            new THREE.PlaneGeometry(1.04, 0.68),
            new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.88 })
        )
        card.position.set(-0.4, 0.18, 0.072)
        card.rotation.z = -0.04
        group.add(card)

        // Real vesikalık photo pinned on corkboard
        const photoMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.6 })
        this.loader.load('/assets/img/vesikalik.jpg', (tex) =>
        {
            tex.colorSpace = THREE.SRGBColorSpace
            photoMat.map = tex
            photoMat.color.setHex(0xffffff)
            photoMat.needsUpdate = true
        })
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.62), photoMat)
        photo.position.set(0.58, 0.22, 0.072)
        photo.rotation.z = 0.06
        group.add(photo)

        // Small colorful push-pins
        const pinGeo = new THREE.SphereGeometry(0.032, 10, 8)
        for(const [px, py, col] of [[-0.4, 0.48, 0xef4444], [0.58, 0.50, 0x2dd4bf], [0.48, -0.18, 0xf59e42], [-0.36, -0.20, 0xa78bfa]])
        {
            const pin = new THREE.Mesh(pinGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.2 }))
            pin.position.set(px, py, 0.09)
            group.add(pin)
        }

        for(const [x, y, col, r] of [[0.48, -0.36, 0xdfd08a, -0.06], [-0.36, -0.38, 0xdfb9cb, 0.04]])
        {
            const n = new THREE.Mesh(
                new THREE.PlaneGeometry(0.54, 0.36),
                new THREE.MeshStandardMaterial({ color: col, roughness: 0.90 })
            )
            n.position.set(x, y, 0.07)
            n.rotation.z = r
            group.add(n)
        }

        const stand = rbox(1.4, 0.12, 0.40, frameMat, 0.02)
        stand.position.set(0, -1.29, 0.06)
        group.add(stand)

        tagStation(group, 'about')
        this.scene.add(group)
        this.clickTargets.push(group)
        this.obstacles.push({ x: -5.65, z: -2.95, r: 0.95, maxY: 2.2 })

        // Jumpable Stack of Hardcover Books (left middle)
        const bookSpecs = [
            { col: 0x2c5282, w: 1.32, d: 0.96, rot: -0.10 },
            { col: 0x9b2c5c, w: 1.22, d: 0.90, rot:  0.04 },
            { col: 0xb96a2a, w: 1.12, d: 0.84, rot:  0.14 },
        ]
        bookSpecs.forEach((b, i) =>
        {
            const book = rbox(b.w, 0.18, b.d, new THREE.MeshStandardMaterial({ color: b.col, roughness: 0.65 }), 0.025)
            book.position.set(-6.7, 0.09 + i * 0.18, 0.78)
            book.rotation.y = b.rot
            this.scene.add(book)
        })
        this.platforms.push({ minX: -7.40, maxX: -6.00, minZ: 0.22, maxZ: 1.32, y: 0.54 })

        // Cozy Plush Kömür Cat Bed on the left-front corner (jumpable soft platform!)
        const { bumpMap: furBump } = createFurTextures()
        const bedRimMat = new THREE.MeshPhysicalMaterial({
            color: 0x3b354b,
            bumpMap: furBump,
            bumpScale: 0.012,
            roughness: 0.86,
            sheen: 0.65,
            sheenColor: new THREE.Color(0x8b7fb0),
        })
        const cushionMat = new THREE.MeshPhysicalMaterial({
            color: 0xd8d0c2,
            bumpMap: furBump,
            bumpScale: 0.01,
            roughness: 0.92,
            sheen: 0.45,
            sheenColor: new THREE.Color(0xffffff),
        })
        const bedGroup = new THREE.Group()
        bedGroup.position.set(-6.45, 0, 2.85)
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.22, 16, 32), bedRimMat)
        rim.rotation.x = Math.PI * 0.5
        rim.position.y = 0.22
        rim.scale.set(1.08, 0.92, 0.82)
        rim.castShadow = true
        rim.receiveShadow = true
        bedGroup.add(rim)
        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.16, 26), cushionMat)
        cushion.position.y = 0.08
        cushion.scale.set(1.06, 1, 0.90)
        cushion.receiveShadow = true
        bedGroup.add(cushion)
        this.scene.add(bedGroup)
        this.platforms.push({ minX: -7.35, maxX: -5.55, minZ: 2.10, maxZ: 3.60, y: 0.16 })
    }

    _buildSketchbookAndMug()
    {
        // Open Sketchbook (GALERİ) — balanced matte paper albedo so spotlight NEVER causes whiteout!
        const skGroup = new THREE.Group()
        skGroup.position.set(-4.75, 0.045, 2.55)
        skGroup.rotation.y = 0.22

        const cover = rbox(1.82, 0.07, 1.28, new THREE.MeshStandardMaterial({ color: 0x27243b, roughness: 0.68 }), 0.02)
        skGroup.add(cover)

        const pageMat = new THREE.MeshStandardMaterial({ color: 0xa6a095, roughness: 0.96, metalness: 0 })
        this.loader.load('/assets/img/grafik-animasyon/p6-sonrasi.webp', (tex) =>
        {
            tex.colorSpace = THREE.SRGBColorSpace
            pageMat.map = tex
            pageMat.color.setHex(0xc8c4bc) // slight matte attenuation under spot lamp
            pageMat.needsUpdate = true
        })
        const page = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 1.14), pageMat)
        page.rotation.x = -Math.PI * 0.5
        page.position.y = 0.042
        page.receiveShadow = true
        skGroup.add(page)

        // Brushed turquoise stylus pen
        const stylus = new THREE.Mesh(
            new THREE.CylinderGeometry(0.026, 0.026, 1.08, 12),
            new THREE.MeshStandardMaterial({ color: 0x26b8a8, roughness: 0.32, metalness: 0.55 })
        )
        stylus.rotation.z = Math.PI * 0.5
        stylus.rotation.y = 0.38
        stylus.position.set(0.18, 0.068, 0.46)
        stylus.castShadow = true
        skGroup.add(stylus)

        tagStation(skGroup, 'gallery')
        this.scene.add(skGroup)
        this.clickTargets.push(skGroup)

        // Glazed terracotta coffee mug with gentle rising steam
        const mugGroup = new THREE.Group()
        mugGroup.position.set(-3.15, 0, 2.75)
        const mugMat = new THREE.MeshStandardMaterial({ color: 0xb8563a, roughness: 0.32, metalness: 0.08 })
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.46, 26), mugMat)
        mug.position.y = 0.23
        mug.castShadow = true
        mug.receiveShadow = true
        mugGroup.add(mug)

        const coffee = new THREE.Mesh(
            new THREE.CircleGeometry(0.20, 22),
            new THREE.MeshStandardMaterial({ color: 0x2d180d, roughness: 0.14 })
        )
        coffee.rotation.x = -Math.PI * 0.5
        coffee.position.y = 0.445
        mugGroup.add(coffee)

        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 10, 20, Math.PI), mugMat)
        handle.rotation.z = -Math.PI * 0.5
        handle.position.set(0.23, 0.24, 0)
        mugGroup.add(handle)

        for(let i = 0; i < 5; i++)
        {
            const puff = new THREE.Mesh(
                new THREE.SphereGeometry(0.055, 10, 8),
                new THREE.MeshBasicMaterial({ color: 0xfff4e4, transparent: true, opacity: 0.20, depthWrite: false })
            )
            puff.position.set(0, 0.5 + i * 0.16, 0)
            mugGroup.add(puff)
            this.steamPuffs.push({ mesh: puff, offset: i * 0.72 })
        }
        this.scene.add(mugGroup)
        this.obstacles.push({ x: -3.15, z: 2.75, r: 0.36, maxY: 0.55 })
    }

    _buildBlogNotebook()
    {
        // Matte cream journal notebook (BLOG) — balanced paper tone, readable & crisp!
        const group = new THREE.Group()
        group.position.set(-1.45, 0.045, 2.85)
        group.rotation.y = -0.12

        group.add(rbox(1.42, 0.08, 1.04, new THREE.MeshStandardMaterial({ color: 0x3f2375, roughness: 0.65 }), 0.02))

        const c = document.createElement('canvas')
        c.width = 256
        c.height = 192
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#c4bcb0'
        ctx.fillRect(0, 0, 256, 192)
        ctx.fillStyle = '#7c5cd6'
        ctx.fillRect(16, 18, 136, 14)
        ctx.fillStyle = '#5c6678'
        for(let y = 48; y < 174; y += 17)
            ctx.fillRect(16, y, 212 - (y % 48), 5)

        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        const page = new THREE.Mesh(
            new THREE.PlaneGeometry(1.30, 0.94),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96 })
        )
        page.rotation.x = -Math.PI * 0.5
        page.position.y = 0.045
        page.receiveShadow = true
        group.add(page)

        tagStation(group, 'blog')
        this.scene.add(group)
        this.clickTargets.push(group)
    }

    _buildKomurShowcaseStand()
    {
        // Dedicated Kömür v2.4.0 Showcase Display + Floating Chartreuse Crystal (right of monitors)
        const showcase = new THREE.Group()
        showcase.position.set(3.95, 0, -2.65)
        showcase.rotation.y = -0.26

        const pedMat = new THREE.MeshStandardMaterial({ color: 0x1b1e2c, roughness: 0.34, metalness: 0.72 })
        const ped = rbox(1.55, 0.14, 0.85, pedMat, 0.03)
        ped.position.y = 0.07
        showcase.add(ped)

        // Angled tablet/mini-display running Kömür v2.4.0 promo cover
        const tabletFrame = rbox(1.48, 0.94, 0.08, pedMat, 0.03)
        tabletFrame.position.set(0, 0.62, -0.05)
        tabletFrame.rotation.x = -0.22
        showcase.add(tabletFrame)

        const scrMat = new THREE.MeshBasicMaterial({ color: 0xe6e6e6 })
        this.loader.load('/assets/img/real/komur.jpg', (tex) =>
        {
            tex.colorSpace = THREE.SRGBColorSpace
            scrMat.map = tex
            scrMat.color.setHex(0xffffff)
            scrMat.needsUpdate = true
        })
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.82), scrMat)
        scr.position.set(0, 0.625, -0.004)
        scr.rotation.x = -0.22
        showcase.add(scr)

        // Floating chartreuse-gold crystal & brushed gold orbit ring (matches Kömür's eyes!)
        this.komurGem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.20, 0),
            new THREE.MeshStandardMaterial({
                color: 0xdfe644,
                emissive: 0xbcc426,
                emissiveIntensity: 0.65,
                roughness: 0.16,
                metalness: 0.35,
            })
        )
        this.komurGem.position.set(0, 1.48, 0.05)
        this.komurGem.castShadow = true
        showcase.add(this.komurGem)

        this.komurRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.32, 0.016, 10, 32),
            new THREE.MeshStandardMaterial({ color: 0xe6b84c, roughness: 0.25, metalness: 0.85 })
        )
        this.komurRing.position.set(0, 1.48, 0.05)
        showcase.add(this.komurRing)

        tagStation(showcase, 'komur')
        this.scene.add(showcase)
        this.clickTargets.push(showcase)
        this.obstacles.push({ x: 3.95, z: -2.65, r: 0.85, maxY: 1.6 })
    }

    _buildPhoneAndHeadphones()
    {
        // Standing Aluminum Smartphone (İLETİŞİM) + Studio Headphone Stand on right side of main desk
        const phoneGroup = new THREE.Group()
        phoneGroup.position.set(6.45, 0, 1.35)
        phoneGroup.rotation.y = -0.46

        const stand = rbox(0.62, 0.08, 0.62, new THREE.MeshStandardMaterial({ color: 0x252836, roughness: 0.38, metalness: 0.58 }), 0.02)
        stand.position.y = 0.04
        phoneGroup.add(stand)

        const body = rbox(0.58, 1.14, 0.07, new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.22, metalness: 0.74 }), 0.03)
        body.position.set(0, 0.62, 0)
        body.rotation.x = -0.24
        phoneGroup.add(body)

        const pCanvas = document.createElement('canvas')
        pCanvas.width = 128
        pCanvas.height = 240
        const ctx = pCanvas.getContext('2d')
        ctx.fillStyle = '#0e1626'
        ctx.fillRect(0, 0, 128, 240)
        ctx.fillStyle = '#2dd4bf'
        ctx.beginPath()
        ctx.roundRect(14, 32, 100, 44, 10)
        ctx.fill()
        ctx.fillStyle = '#0f172a'
        ctx.font = '800 17px sans-serif'
        ctx.fillText('İLETİŞİM', 24, 60)
        ctx.fillStyle = '#283548'
        ctx.beginPath()
        ctx.roundRect(14, 96, 100, 26, 8)
        ctx.roundRect(14, 134, 80, 26, 8)
        ctx.fill()
        ctx.fillStyle = '#f59e42'
        ctx.beginPath()
        ctx.arc(64, 198, 16, 0, Math.PI * 2)
        ctx.fill()

        const pTex = new THREE.CanvasTexture(pCanvas)
        pTex.colorSpace = THREE.SRGBColorSpace
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.49, 0.98), new THREE.MeshBasicMaterial({ map: pTex }))
        screen.position.set(0, 0.625, 0.042)
        screen.rotation.x = -0.24
        phoneGroup.add(screen)

        tagStation(phoneGroup, 'contact')
        this.scene.add(phoneGroup)
        this.clickTargets.push(phoneGroup)
        this.obstacles.push({ x: 6.45, z: 1.35, r: 0.52, maxY: 1.3 })

        // Studio Over-Ear Headphones on a brushed-metal stand behind the phone
        const hpGroup = new THREE.Group()
        hpGroup.position.set(6.85, 0, -1.25)
        hpGroup.rotation.y = -0.55
        const hpMetal = new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.32, metalness: 0.78 })
        const hpPad = new THREE.MeshStandardMaterial({ color: 0x161822, roughness: 0.85 })
        const hpBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.07, 20), hpMetal)
        hpBase.position.y = 0.035
        hpGroup.add(hpBase)
        const hpStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.28, 12), hpMetal)
        hpStem.position.y = 0.68
        hpStem.castShadow = true
        hpGroup.add(hpStem)
        const headband = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.048, 12, 24, Math.PI), hpPad)
        headband.position.y = 1.05
        headband.castShadow = true
        hpGroup.add(headband)
        for(const sx of [-0.36, 0.36])
        {
            const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 18), hpPad)
            cup.rotation.z = Math.PI * 0.5
            cup.position.set(sx, 0.92, 0)
            cup.castShadow = true
            hpGroup.add(cup)
        }
        this.scene.add(hpGroup)
        this.obstacles.push({ x: 6.85, z: -1.25, r: 0.45, maxY: 1.5 })

        // Terracotta Succulent Plant
        const potGroup = new THREE.Group()
        potGroup.position.set(7.35, 0, 0.15)
        const pot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.36, 0.26, 0.48, 22),
            new THREE.MeshStandardMaterial({ color: 0xb86242, roughness: 0.76 })
        )
        pot.position.y = 0.24
        pot.castShadow = true
        pot.receiveShadow = true
        potGroup.add(pot)

        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2ca97a, roughness: 0.58 })
        for(let i = 0; i < 10; i++)
        {
            const a = (i / 10) * Math.PI * 2
            const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 7), leafMat)
            leaf.position.set(Math.cos(a) * 0.16, 0.55, Math.sin(a) * 0.16)
            leaf.rotation.z = -Math.cos(a) * 0.50
            leaf.rotation.x = Math.sin(a) * 0.50
            leaf.castShadow = true
            potGroup.add(leaf)
        }
        this.scene.add(potGroup)
        this.obstacles.push({ x: 7.35, z: 0.15, r: 0.44, maxY: 0.9 })
    }

    _buildRightWingDesignAndCatTree()
    {
        // 1. Graphic & Animation Pen Tablet Station on the expanded right L-wing!
        const designGroup = new THREE.Group()
        designGroup.position.set(5.9, 0, 4.9)
        designGroup.rotation.y = -0.35

        const tabBody = rbox(2.05, 0.09, 1.38, new THREE.MeshStandardMaterial({ color: 0x181b26, roughness: 0.38, metalness: 0.5 }), 0.03)
        tabBody.position.y = 0.045
        designGroup.add(tabBody)

        const artMat = new THREE.MeshBasicMaterial({ color: 0xe2e2e2 })
        this.loader.load('/assets/img/grafik-animasyon/p1-sonrasi.webp', (tex) =>
        {
            tex.colorSpace = THREE.SRGBColorSpace
            artMat.map = tex
            artMat.color.setHex(0xffffff)
            artMat.needsUpdate = true
        })
        const artScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 1.12), artMat)
        artScreen.rotation.x = -Math.PI * 0.5
        artScreen.position.set(0.1, 0.095, 0)
        designGroup.add(artScreen)

        // Side express-key buttons on tablet
        const btnMat = new THREE.MeshStandardMaterial({ color: 0x333a4f, roughness: 0.4 })
        for(let i = 0; i < 4; i++)
        {
            const b = rbox(0.11, 0.025, 0.14, btnMat, 0.008)
            b.position.set(-0.86, 0.095, -0.36 + i * 0.24)
            designGroup.add(b)
        }

        tagStation(designGroup, 'design')
        this.scene.add(designGroup)
        this.clickTargets.push(designGroup)
        this.platforms.push({ minX: 4.8, maxX: 7.0, minZ: 4.1, maxZ: 5.7, y: 0.10 })

        // 2. Desktop Kömür Cat Scratching Tower on the far-right L-wing corner (jumpable 1st shelf!)
        const { map: sisalMap, bumpMap: sisalBump } = createSisalTextures()
        const sisalMat = new THREE.MeshStandardMaterial({
            map: sisalMap,
            bumpMap: sisalBump,
            bumpScale: 0.025,
            roughness: 0.92,
        })
        const { bumpMap: furBump } = createFurTextures()
        const plushMat = new THREE.MeshPhysicalMaterial({
            color: 0x3a3248,
            bumpMap: furBump,
            bumpScale: 0.012,
            roughness: 0.88,
            sheen: 0.6,
            sheenColor: new THREE.Color(0x9183b3),
        })

        const tower = new THREE.Group()
        tower.position.set(7.95, 0, 5.95)

        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.12, 0.16, 26), plushMat)
        base.position.y = 0.08
        base.castShadow = true
        base.receiveShadow = true
        tower.add(base)

        const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.82, 18), sisalMat)
        post1.position.set(-0.28, 0.52, -0.15)
        post1.castShadow = true
        tower.add(post1)

        const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 1.85, 18), sisalMat)
        post2.position.set(0.32, 1.04, 0.22)
        post2.castShadow = true
        tower.add(post2)

        // 1st Jumpable Lounge Platform (y = 0.92 — Kömür can jump right onto it!)
        const shelf1 = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.74, 0.12, 24), this.woodMat)
        shelf1.position.set(-0.22, 0.92, -0.12)
        shelf1.castShadow = true
        shelf1.receiveShadow = true
        tower.add(shelf1)

        // Top perch cushion
        const shelf2 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.14, 24), plushMat)
        shelf2.position.set(0.32, 1.98, 0.22)
        shelf2.castShadow = true
        shelf2.receiveShadow = true
        tower.add(shelf2)

        // Dangling chartreuse toy ball on a sisal cord (real pendulum animation!)
        this.pendulumPivot = new THREE.Group()
        this.pendulumPivot.position.set(0.32, 1.90, -0.25)
        tower.add(this.pendulumPivot)

        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6), sisalMat)
        cord.position.y = -0.23
        this.pendulumPivot.add(cord)

        const pom = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 16, 14),
            new THREE.MeshStandardMaterial({ color: 0xdfe644, roughness: 0.72, emissive: 0x5c6112, emissiveIntensity: 0.25 })
        )
        pom.position.y = -0.50
        pom.castShadow = true
        this.pendulumPivot.add(pom)

        this.scene.add(tower)
        this.platforms.push({ minX: 6.95, maxX: 8.55, minZ: 5.05, maxZ: 6.60, y: 0.98 })
        this.obstacles.push({ x: 8.27, z: 6.17, r: 0.28, maxY: 2.1 })
    }

    _buildPushableProps()
    {
        // 1. Sculpted Woven Pink Yarn Ball (with wrapped wool strands!)
        const yarnGroup = new THREE.Group()
        const yarnMat = new THREE.MeshPhysicalMaterial({ color: 0xd95679, roughness: 0.88, sheen: 0.55, sheenColor: new THREE.Color(0xffb8cb) })
        const stripeMat = new THREE.MeshPhysicalMaterial({ color: 0xef83a0, roughness: 0.86, sheen: 0.45 })
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), yarnMat)
        core.castShadow = true
        yarnGroup.add(core)
        for(const [rx, ry, rz] of [[0.4, 0, 0], [0, 1.0, 0.6], [1.2, 0.4, 0.8], [0.7, 1.4, 0.3]])
        {
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.024, 8, 22), stripeMat)
            band.rotation.set(rx, ry, rz)
            yarnGroup.add(band)
        }
        yarnGroup.position.set(2.35, 0.24, 1.55)
        this.scene.add(yarnGroup)
        this.pushables.push({
            mesh: yarnGroup,
            initPos: yarnGroup.position.clone(),
            vx: 0,
            vz: 0,
            radius: 0.25,
            rolls: true,
        })

        // 2. Two Wooden Pencils
        const pencilSpecs = [
            { col: 0xe6ad38, pos: [-2.45, 0.055, 1.15], rot: 0.35 },
            { col: 0x38a5e0, pos: [3.25, 0.055, 0.65], rot: -0.45 },
        ]
        for(const ps of pencilSpecs)
        {
            const pGroup = new THREE.Group()
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.78, 8), new THREE.MeshStandardMaterial({ color: ps.col, roughness: 0.48 }))
            shaft.rotation.z = Math.PI * 0.5
            shaft.castShadow = true
            pGroup.add(shaft)
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xd9b38c, roughness: 0.75 }))
            tip.rotation.z = -Math.PI * 0.5
            tip.position.x = 0.46
            pGroup.add(tip)
            pGroup.rotation.y = ps.rot
            pGroup.position.set(...ps.pos)
            this.scene.add(pGroup)
            this.pushables.push({
                mesh: pGroup,
                initPos: pGroup.position.clone(),
                vx: 0,
                vz: 0,
                radius: 0.16,
                rolls: false,
            })
        }

        // 3. Cute Plush Toy Mouse on the right L-wing for Kömür to bat around!
        const toyMouse = new THREE.Group()
        const mBody = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 14, 12),
            new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 })
        )
        mBody.scale.set(1.35, 0.82, 0.92)
        mBody.castShadow = true
        toyMouse.add(mBody)
        for(const sz of [-0.07, 0.07])
        {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf4a4b4, roughness: 0.8 }))
            ear.position.set(0.09, 0.08, sz)
            toyMouse.add(ear)
        }
        toyMouse.position.set(5.35, 0.12, 2.75)
        this.scene.add(toyMouse)
        this.pushables.push({
            mesh: toyMouse,
            initPos: toyMouse.position.clone(),
            vx: 0,
            vz: 0,
            radius: 0.18,
            rolls: false,
        })
    }

    resetProps()
    {
        for(const p of this.pushables)
        {
            p.mesh.position.copy(p.initPos)
            p.vx = 0
            p.vz = 0
        }
    }

    setLampMode(mode)
    {
        this.lampMode = mode
        if(mode === 'day')
        {
            this.scene.background = new THREE.Color(0x1a2438)
            this.hemi.intensity = 1.18
            this.sun.intensity = 1.75
            this.sun.color.setHex(0xfff5e4)
            this.lampLight.intensity = 1.4
            this.wingLight.intensity = 1.2
            this.lampBulbMat.color.setRGB(1.0, 0.92, 0.78)
            this.lampCone.visible = false
        }
        else if(mode === 'night')
        {
            this.scene.background = new THREE.Color(0x070912)
            this.hemi.intensity = 0.34
            this.sun.intensity = 0.42
            this.sun.color.setHex(0x818cf8)
            this.lampLight.intensity = 10.5
            this.wingLight.intensity = 2.0
            this.lampBulbMat.color.setRGB(2.2, 1.55, 0.78)
            this.lampCone.visible = true
            this.lampCone.material.opacity = 0.50
        }
        else
        {
            this.scene.background = new THREE.Color(0x0f111c)
            this.hemi.intensity = 0.72
            this.sun.intensity = 1.35
            this.sun.color.setHex(0xffbe80)
            this.lampLight.intensity = 8.5
            this.wingLight.intensity = 1.65
            this.lampBulbMat.color.setRGB(1.9, 1.38, 0.68)
            this.lampCone.visible = true
            this.lampCone.material.opacity = 0.38
        }
    }

    cycleLampMode()
    {
        const order = ['evening', 'night', 'day']
        const next = order[(order.indexOf(this.lampMode) + 1) % order.length]
        this.setLampMode(next)
        return next
    }

    update(dt, elapsed)
    {
        this.projectTimer += dt
        if(this.projectTimer > 4.5)
        {
            this.projectTimer = 0
            this.projectIndex++
            this._drawMonitorScreen()
        }

        if(!this._lastCodeDraw || elapsed - this._lastCodeDraw > 0.65)
        {
            this._lastCodeDraw = elapsed
            this.codeMonitor?.draw(elapsed * 1.4)
        }

        const wave = (Math.sin(elapsed * 1.6) + 1) * 0.5
        this.kbGlowMat?.color.setRGB(
            THREE.MathUtils.lerp(1.15, 0.32, wave),
            THREE.MathUtils.lerp(0.72, 1.05, wave),
            THREE.MathUtils.lerp(0.28, 0.96, wave)
        )

        for(const k of this.rgbKeys)
        {
            const t = (Math.sin(elapsed * 2.0 + k.phase) + 1) * 0.5
            k.mat.emissive.setRGB(
                THREE.MathUtils.lerp(0.95, 0.16, t),
                THREE.MathUtils.lerp(0.60, 0.82, t),
                THREE.MathUtils.lerp(0.24, 0.76, t)
            )
        }

        if(this.komurGem)
        {
            this.komurGem.rotation.y = elapsed * 1.05
            this.komurGem.position.y = 1.48 + Math.sin(elapsed * 2.2) * 0.06
        }
        if(this.komurRing)
        {
            this.komurRing.rotation.x = Math.PI * 0.36 + Math.sin(elapsed * 1.3) * 0.28
            this.komurRing.rotation.y = elapsed * 1.4
            this.komurRing.position.y = 1.48 + Math.sin(elapsed * 2.2) * 0.06
        }

        if(this.pendulumPivot)
        {
            this.pendulumPivot.rotation.z = Math.sin(elapsed * 2.1) * 0.22
            this.pendulumPivot.rotation.x = Math.cos(elapsed * 1.6) * 0.12
        }

        for(const s of this.steamPuffs)
        {
            const cycle = (elapsed * 0.42 + s.offset) % 1
            s.mesh.position.y = 0.5 + cycle * 0.72
            s.mesh.position.x = Math.sin(elapsed * 2 + s.offset) * 0.05
            s.mesh.scale.setScalar(0.55 + cycle * 0.92)
            s.mesh.material.opacity = (1 - cycle) * 0.20
        }

        // Pushables stay cleanly inside the expanded L-desk footprint & bounce softly off edges
        for(const p of this.pushables)
        {
            let nx = p.mesh.position.x + p.vx * dt
            let nz = p.mesh.position.z + p.vz * dt

            const inWing = nx >= 4.4 && nz >= 3.3
            const minX = inWing ? 4.55 : -7.65
            const maxX = inWing ? 8.95 : 7.65
            const minZ = -3.15
            const maxZ = nx >= 4.4 ? 7.10 : 3.65

            if(nx < minX || nx > maxX) { p.vx *= -0.55; nx = THREE.MathUtils.clamp(nx, minX, maxX) }
            if(nz < minZ || nz > maxZ) { p.vz *= -0.55; nz = THREE.MathUtils.clamp(nz, minZ, maxZ) }

            p.mesh.position.x = nx
            p.mesh.position.z = nz

            if(p.rolls)
            {
                p.mesh.rotation.z -= p.vx * dt * 3.2
                p.mesh.rotation.x += p.vz * dt * 3.2
            }
            p.vx *= Math.pow(0.05, dt)
            p.vz *= Math.pow(0.05, dt)
        }
    }
}
