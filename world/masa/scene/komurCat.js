import * as THREE from 'three'
import { createFurTextures, createKomurEyeTexture } from './textures.js'

const STATE_KEY = 'komur-desk-v3-state'

// Expanded L-Desk walkable footprint:
// Zone A (Main desk): x [-7.75 .. 7.75], z [-3.25 .. 3.65]
// Zone B (Right L-wing): x [4.55 .. 8.95], z [3.20 .. 7.15]
export function clampToLDesk(x, z)
{
    const cx = THREE.MathUtils.clamp(x, -7.75, 8.95)
    const cz = THREE.MathUtils.clamp(z, -3.25, 7.15)

    // Inside main desk
    if(cx <= 7.75 && cz <= 3.65)
        return { x: cx, z: cz }

    // Inside right L-wing
    if(cx >= 4.55 && cx <= 8.95 && cz >= 3.20 && cz <= 7.15)
        return { x: cx, z: cz }

    // Outside the inner-left cutout (x < 4.55 && z > 3.65) or far-right back (x > 7.75 && z < 3.20)
    if(cx > 7.75 && cz < 3.20)
    {
        const dMain = cx - 7.75
        const dWing = 3.20 - cz
        return dMain < dWing ? { x: 7.75, z: cz } : { x: cx, z: 3.20 }
    }

    // Cutout corner (cx < 4.55 && cz > 3.65)
    const dToMain = cz - 3.65
    const dToWing = 4.55 - cx
    return dToMain <= dToWing ? { x: cx, z: 3.65 } : { x: 4.55, z: cz }
}

function createSculptedEarGeometry()
{
    const geo = new THREE.ConeGeometry(0.11, 0.28, 16, 6, false)
    const pos = geo.attributes.position
    for(let i = 0; i < pos.count; i++)
    {
        let x = pos.getX(i)
        let y = pos.getY(i)
        let z = pos.getZ(i)
        const h = (y + 0.14) / 0.28

        // Flatten front-to-back (+Z is front of ear in desk coordinates)
        if(z > 0) z *= 0.42
        else z *= 0.86

        const widen = 1.0 + Math.sin(h * Math.PI) * 0.22
        x *= widen
        z += Math.pow(h, 2) * 0.025
        pos.setXYZ(i, x, y, z)
    }
    geo.computeVertexNormals()
    return geo
}

export class KomurCat
{
    constructor(scene)
    {
        this.scene = scene
        this.group = new THREE.Group()
        this.position = new THREE.Vector3(0, 0, 0.85)
        this.velocity = new THREE.Vector3()
        this.vy = 0
        this.onGround = true
        this.groundY = 0
        this.rotationY = Math.PI * 0.08
        this.targetPoint = null
        this.walkPhase = 0
        this.smoothSpeed = 0
        this.idleTime = 0
        this.blinkTimer = 2.6
        this.isBlinking = false
        this.earTwitchTimer = 3.2
        this.squash = 1
        this.stepTimer = 0
        this.petTimer = 0
        this.puffs = []
        this.hearts = []
        this._audioCtx = null

        this._buildModel()
        this._buildTargetRing()
        this._buildParticles()
        this._restorePosition()
        this.group.position.copy(this.position)
        this.group.rotation.y = this.rotationY
        this.scene.add(this.group)

        window.addEventListener('pagehide', () => this.savePosition())
        window.addEventListener('beforeunload', () => this.savePosition())
        setInterval(() => this.savePosition(), 2500)
    }

    _buildModel()
    {
        // PBR short-hair cat fur textures (directional fur grain + velvet sheen)
        const { bumpMap, roughnessMap } = createFurTextures()

        // Sitedeki Kömür v2.4.0 paleti: derin kömür siyahı + gümüş-mavi kadife parlaması
        const blackFurMat = new THREE.MeshPhysicalMaterial({
            color: 0x12161f,
            bumpMap,
            bumpScale: 0.008,
            roughnessMap,
            roughness: 0.72,
            metalness: 0.04,
            sheen: 0.85,
            sheenRoughness: 0.52,
            sheenColor: new THREE.Color(0x6d84a6),
        })

        // Kabarık smokin beyaz göğüs önlüğü ve 4 beyaz çorap pati (#f1efec / #fffaf2)
        const whiteFurMat = new THREE.MeshPhysicalMaterial({
            color: 0xf1eee7,
            bumpMap,
            bumpScale: 0.007,
            roughnessMap,
            roughness: 0.78,
            metalness: 0.0,
            sheen: 0.55,
            sheenRoughness: 0.62,
            sheenColor: new THREE.Color(0xffffff),
        })

        // Koyu füme kulak içi (pembe değil — sitedeki gerçek Kömür!)
        const innerEarMat = new THREE.MeshStandardMaterial({
            color: 0x2f3540,
            roughness: 0.82,
        })

        // Gümüş-beyaz iç kulak tüy tutamları (Kömür v2.4.0 imza detayı)
        const earTuftMat = new THREE.MeshStandardMaterial({
            color: 0xcbd0d8,
            roughness: 0.7,
        })

        // Nemli parlak koyu kömür-gri kedi burnu (pembe değil!)
        const noseMat = new THREE.MeshPhysicalMaterial({
            color: 0x1d212a,
            roughness: 0.25,
            clearcoat: 0.85,
            clearcoatRoughness: 0.14,
        })

        // 512x512 ıslak sarı-yeşil (chartreuse) kedi gözü + cam gibi clearcoat kornea
        const eyeTex = createKomurEyeTexture()
        const eyeMat = new THREE.MeshPhysicalMaterial({
            map: eyeTex,
            emissive: new THREE.Color(0x8c961d),
            emissiveMap: eyeTex,
            emissiveIntensity: 0.28,
            roughness: 0.08,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
        })

        const whiskerMat = new THREE.MeshStandardMaterial({
            color: 0xf4f6fa,
            roughness: 0.45,
        })

        // Sitedeki yürüyen Kömür'den ilham: kırmızı örme atkı (göğüs önlüğünü kapatmaz!)
        const scarfMat = new THREE.MeshPhysicalMaterial({
            color: 0xc23333,
            bumpMap,
            bumpScale: 0.01,
            roughness: 0.85,
            sheen: 0.65,
            sheenColor: new THREE.Color(0xff9a8a),
        })

        const addMesh = (parent, mesh, cast = true, receive = true) =>
        {
            mesh.castShadow = cast
            mesh.receiveShadow = receive
            mesh.userData.isKomur = true
            parent.add(mesh)
            return mesh
        }

        // Scale nicely for the expanded studio desk (~0.95m long sleek desktop cat)
        this.bodyGroup = new THREE.Group()
        this.group.add(this.bodyGroup)

        // 1. Sculpted Organic Feline Torso (+Z forward, +Y up)
        const spineProfile = [
            new THREE.Vector2(0.01, -0.48),
            new THREE.Vector2(0.11, -0.45),
            new THREE.Vector2(0.22, -0.36),
            new THREE.Vector2(0.255, -0.24), // rounded hindquarters
            new THREE.Vector2(0.23, -0.08),  // slender waist
            new THREE.Vector2(0.225, 0.08),
            new THREE.Vector2(0.26,  0.24),  // ribcage
            new THREE.Vector2(0.27,  0.37),  // proud chest
            new THREE.Vector2(0.21,  0.46),
            new THREE.Vector2(0.10,  0.50),
            new THREE.Vector2(0.01,  0.52),
        ]
        const torsoGeo = new THREE.LatheGeometry(spineProfile, 28)
        torsoGeo.rotateX(Math.PI * 0.5) // Lathe Y -> +Z forward
        const torso = addMesh(this.bodyGroup, new THREE.Mesh(torsoGeo, blackFurMat))
        torso.position.set(0, 0.44, 0)
        torso.scale.set(0.84, 0.96, 1.0)

        // Smooth neck bridge
        const neck = addMesh(this.bodyGroup, new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.20, 0.26, 20), blackFurMat))
        neck.position.set(0, 0.59, 0.40)
        neck.rotation.x = 0.44
        neck.scale.set(0.88, 1.0, 1.0)

        // Signature Fluffy White Tuxedo Chest Bib (+ feathered V-tip tufts!)
        const bibMain = addMesh(this.bodyGroup, new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 16), whiteFurMat))
        bibMain.scale.set(0.94, 1.12, 0.74)
        bibMain.position.set(0, 0.44, 0.40)

        const bibUpper = addMesh(this.bodyGroup, new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 14), whiteFurMat))
        bibUpper.scale.set(0.92, 0.92, 0.78)
        bibUpper.position.set(0, 0.55, 0.45)

        for(const [bx, by, bz, r] of [[0, 0.27, 0.35, 0.08], [-0.08, 0.31, 0.37, 0.065], [0.08, 0.31, 0.37, 0.065]])
        {
            const tf = addMesh(this.bodyGroup, new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), whiteFurMat))
            tf.scale.set(0.75, 1.32, 0.92)
            tf.position.set(bx, by, bz)
        }

        // Red knit scarf draped cleanly around the outside of the neck (leaves tuxedo bib visible, zero clipping!)
        const scarfRing = addMesh(this.bodyGroup, new THREE.Mesh(new THREE.TorusGeometry(0.212, 0.036, 14, 28), scarfMat))
        scarfRing.rotation.x = Math.PI * 0.5 - 0.36
        scarfRing.position.set(0, 0.585, 0.445)
        scarfRing.scale.set(0.95, 1.0, 1.02)

        this.scarfTailPivot = new THREE.Group()
        this.scarfTailPivot.position.set(0.165, 0.54, 0.485)
        this.bodyGroup.add(this.scarfTailPivot)

        const tailA = addMesh(this.scarfTailPivot, new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.18, 0.062), scarfMat))
        tailA.position.set(0.02, -0.08, 0.01)
        tailA.rotation.x = 0.22
        tailA.rotation.z = 0.16

        const tailB = addMesh(this.scarfTailPivot, new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.135, 0.052), scarfMat))
        tailB.position.set(0.034, -0.068, 0.045)
        tailB.rotation.x = 0.08
        tailB.rotation.z = 0.24

        // 2. Expressive Sculpted Cat Head (+Z forward)
        this.headGroup = new THREE.Group()
        this.headGroup.position.set(0, 0.74, 0.52)
        this.bodyGroup.add(this.headGroup)

        const cranium = addMesh(this.headGroup, new THREE.Mesh(new THREE.SphereGeometry(0.245, 28, 22), blackFurMat))
        cranium.scale.set(1.08, 0.92, 0.98)

        // Soft cheek ruffs
        for(const sx of [-0.12, 0.12])
        {
            const cheek = addMesh(this.headGroup, new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), blackFurMat))
            cheek.scale.set(1.08, 0.78, 0.92)
            cheek.position.set(sx, -0.065, 0.065)
        }

        // Muzzle & whisker pads + white chin tuft
        const muzzle = addMesh(this.headGroup, new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 14), blackFurMat))
        muzzle.scale.set(0.95, 0.76, 1.08)
        muzzle.position.set(0, -0.03, 0.17)

        for(const sx of [-0.048, 0.048])
        {
            const pad = addMesh(this.headGroup, new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), blackFurMat))
            pad.scale.set(1.04, 0.84, 0.96)
            pad.position.set(sx, -0.062, 0.215)
        }

        const chin = addMesh(this.headGroup, new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), whiteFurMat))
        chin.scale.set(1.15, 0.62, 0.90)
        chin.position.set(0, -0.112, 0.19)

        // Small glossy charcoal cat nose
        const noseGeo = new THREE.ConeGeometry(0.032, 0.040, 6)
        noseGeo.rotateX(Math.PI)
        const nose = addMesh(this.headGroup, new THREE.Mesh(noseGeo, noseMat), false, true)
        nose.scale.set(1.22, 0.88, 0.75)
        nose.position.set(0, -0.032, 0.262)

        // Tall Sculpted Cat Ears + Charcoal Inner Shell + Silver-White Ear Tufts!
        this.ears = []
        const outerEarGeo = createSculptedEarGeometry()
        const innerEarGeo = createSculptedEarGeometry()
        innerEarGeo.scale(0.68, 0.76, 0.68)

        for(const sx of [-0.135, 0.135])
        {
            const side = sx > 0 ? 1 : -1
            const earPivot = new THREE.Group()
            earPivot.position.set(sx, 0.205, -0.015)
            earPivot.rotation.z = -side * 0.24
            earPivot.rotation.x = 0.08
            earPivot.rotation.y = side * 0.14

            const outerEar = addMesh(earPivot, new THREE.Mesh(outerEarGeo, blackFurMat))
            outerEar.position.y = 0.075

            const innerEar = addMesh(earPivot, new THREE.Mesh(innerEarGeo, innerEarMat), false, true)
            innerEar.position.set(-side * 0.005, 0.062, 0.022)

            // Signature silver-white wispy inner ear tufts
            for(let ti = 0; ti < 2; ti++)
            {
                const tuft = addMesh(
                    earPivot,
                    new THREE.Mesh(new THREE.ConeGeometry(0.017 - ti * 0.004, 0.088 - ti * 0.015, 6), earTuftMat),
                    false,
                    false
                )
                tuft.position.set(-side * (0.02 - ti * 0.01), 0.02 + ti * 0.035, 0.035)
                tuft.rotation.z = side * (0.55 + ti * 0.18)
                tuft.rotation.x = 0.42
            }

            this.headGroup.add(earPivot)
            this.ears.push({ pivot: earPivot, baseZ: earPivot.rotation.z, side })
        }

        // Recessed Large Expressive Chartreuse-Gold Wet Cat Eyes + Eyelid Brow Hood
        // SphereGeometry UV center (0.5, 0.5) faces +X, so rotateY(-PI/2) aligns iris cleanly to +Z!
        this.eyes = []
        const eyeGeo = new THREE.SphereGeometry(0.068, 24, 20)
        const browLidGeo = new THREE.TorusGeometry(0.064, 0.013, 10, 20, Math.PI * 1.15)
        for(const sx of [-0.094, 0.094])
        {
            const side = sx > 0 ? 1 : -1
            const eyeGroup = new THREE.Group()
            eyeGroup.position.set(sx, 0.036, 0.174)
            eyeGroup.rotation.y = side * 0.22
            eyeGroup.rotation.x = -0.04

            const eyeBall = addMesh(eyeGroup, new THREE.Mesh(eyeGeo, eyeMat), false, false)
            eyeBall.rotation.y = -Math.PI * 0.5
            eyeBall.scale.set(0.76, 1.02, 1.0)

            const browLid = addMesh(eyeGroup, new THREE.Mesh(browLidGeo, blackFurMat), false, true)
            browLid.rotation.z = -0.08
            browLid.position.set(0, 0.012, 0.026)

            this.headGroup.add(eyeGroup)
            this.eyes.push(eyeGroup)
        }

        // Graceful Curved White Whiskers (4 per cheek + 2 brow whiskers via TubeGeometry)
        for(const side of [-1, 1])
        {
            const rows = [
                { dy:  0.016, fwd: 0.055, len: 0.27, droop: -0.01 },
                { dy:  0.002, fwd: 0.010, len: 0.31, droop: -0.028 },
                { dy: -0.012, fwd: -0.035, len: 0.28, droop: -0.048 },
                { dy: -0.026, fwd: -0.075, len: 0.23, droop: -0.062 },
            ]
            for(const row of rows)
            {
                const curve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(side * 0.07, -0.058 + row.dy, 0.22),
                    new THREE.Vector3(side * (0.07 + row.len * 0.52), -0.058 + row.dy + row.droop * 0.35, 0.21 + row.fwd * 0.25),
                    new THREE.Vector3(side * (0.07 + row.len), -0.058 + row.dy + row.droop, 0.17 + row.fwd * 0.35),
                ])
                this.headGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.0042, 5, false), whiskerMat))
            }

            // Very delicate fine eyebrow whiskers (soft & cute, never angry-looking)
            const browCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(side * 0.09, 0.125, 0.165),
                new THREE.Vector3(side * 0.125, 0.162, 0.175),
                new THREE.Vector3(side * 0.155, 0.180, 0.155),
            ])
            this.headGroup.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 6, 0.0020, 4, false), whiskerMat))
        }

        // 3. Four 2-Joint Articulated Feline Legs with Tuxedo White Socks & 3-Toed Paws!
        this.legs = []
        const legSpecs = [
            { x: -0.135, z:  0.30, isFront: true,  trotPhase: 0,       gallopPhase: 0 },
            { x:  0.135, z:  0.30, isFront: true,  trotPhase: Math.PI, gallopPhase: 0.38 },
            { x: -0.140, z: -0.31, isFront: false, trotPhase: Math.PI, gallopPhase: Math.PI },
            { x:  0.140, z: -0.31, isFront: false, trotPhase: 0,       gallopPhase: Math.PI + 0.38 },
        ]
        for(const spec of legSpecs)
        {
            const upperPivot = new THREE.Group()
            upperPivot.position.set(spec.x, 0.37, spec.z)

            const upperR = spec.isFront ? 0.066 : 0.078
            const upper = addMesh(upperPivot, new THREE.Mesh(new THREE.CapsuleGeometry(upperR, 0.11, 8, 12), blackFurMat))
            upper.position.set(0, -0.08, 0)
            upper.scale.set(0.9, 1.0, 1.08)

            const lowerPivot = new THREE.Group()
            lowerPivot.position.set(0, -0.145, spec.isFront ? -0.01 : -0.02)
            upperPivot.add(lowerPivot)

            const shinBlack = addMesh(lowerPivot, new THREE.Mesh(new THREE.CapsuleGeometry(0.050, 0.065, 6, 12), blackFurMat))
            shinBlack.position.set(0, -0.045, 0)

            // Signature White Tuxedo Sock
            const sock = addMesh(lowerPivot, new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.07, 8, 12), whiteFurMat))
            sock.position.set(0, -0.12, 0.008)

            // White Cat Paw + 3 Sculpted Toes
            const pawGroup = new THREE.Group()
            pawGroup.position.set(0, -0.18, 0.032)
            lowerPivot.add(pawGroup)

            const pawBase = addMesh(pawGroup, new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), whiteFurMat))
            pawBase.scale.set(0.98, 0.64, 1.24)

            for(const tx of [-0.027, 0, 0.027])
            {
                const toe = addMesh(pawGroup, new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), whiteFurMat))
                toe.scale.set(0.88, 0.78, 1.25)
                toe.position.set(tx, -0.009, 0.046 - Math.abs(tx) * 0.35)
            }

            this.bodyGroup.add(upperPivot)
            this.legs.push({
                pivot: upperPivot,
                lowerPivot,
                baseY: 0.37,
                isFront: spec.isFront,
                trotPhase: spec.trotPhase,
                gallopPhase: spec.gallopPhase,
            })
        }

        // 4. Graceful Upward-Curled 4-Segment Black Cat Tail
        this.tailSegments = []
        const tailSpecs = [
            { len: 0.17, rTop: 0.041, rBot: 0.047, pitch: -1.05 },
            { len: 0.17, rTop: 0.035, rBot: 0.041, pitch:  0.44 },
            { len: 0.16, rTop: 0.028, rBot: 0.035, pitch:  0.46 },
            { len: 0.14, rTop: 0.020, rBot: 0.028, pitch:  0.34 },
        ]
        let tailParent = this.bodyGroup
        for(let ti = 0; ti < tailSpecs.length; ti++)
        {
            const ts = tailSpecs[ti]
            const tPivot = new THREE.Group()
            if(ti === 0)
                tPivot.position.set(0, 0.48, -0.47)
            else
                tPivot.position.set(0, tailSpecs[ti - 1].len * 0.94, 0)
            tPivot.rotation.x = ts.pitch

            const segMesh = addMesh(tPivot, new THREE.Mesh(new THREE.CylinderGeometry(ts.rTop, ts.rBot, ts.len, 12), blackFurMat))
            segMesh.position.y = ts.len * 0.5
            const cap = addMesh(tPivot, new THREE.Mesh(new THREE.SphereGeometry(ts.rTop, 10, 8), blackFurMat))
            cap.position.y = ts.len

            tailParent.add(tPivot)
            this.tailSegments.push({ pivot: tPivot, basePitch: ts.pitch })
            tailParent = tPivot
        }

        // Grounded soft ambient occlusion shadow disc
        this.blobShadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.46, 26),
            new THREE.MeshBasicMaterial({ color: 0x05060b, transparent: true, opacity: 0.34, depthWrite: false })
        )
        this.blobShadow.rotation.x = -Math.PI * 0.5
        this.blobShadow.position.y = 0.018
        this.group.add(this.blobShadow)
    }

    _buildTargetRing()
    {
        this.targetRing = new THREE.Mesh(
            new THREE.RingGeometry(0.18, 0.25, 32),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color(1.25, 1.32, 0.32),
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                depthWrite: false,
            })
        )
        this.targetRing.rotation.x = -Math.PI * 0.5
        this.targetRing.visible = false
        this.scene.add(this.targetRing)
    }

    _buildParticles()
    {
        const puffGeo = new THREE.SphereGeometry(0.042, 8, 6)
        const puffMat = new THREE.MeshBasicMaterial({ color: 0xffe4b5, transparent: true, opacity: 0.45, depthWrite: false })
        for(let i = 0; i < 14; i++)
        {
            const mesh = new THREE.Mesh(puffGeo, puffMat.clone())
            mesh.visible = false
            this.scene.add(mesh)
            this.puffs.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 })
        }

        // Cute golden sparkles when Kömür is petted
        const heartGeo = new THREE.OctahedronGeometry(0.055, 0)
        const heartMat = new THREE.MeshBasicMaterial({ color: 0xdfe644, transparent: true, opacity: 0.9 })
        for(let i = 0; i < 8; i++)
        {
            const mesh = new THREE.Mesh(heartGeo, heartMat.clone())
            mesh.visible = false
            this.scene.add(mesh)
            this.hearts.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 })
        }
    }

    _spawnPuff(x, y, z, count = 1)
    {
        let spawned = 0
        for(const p of this.puffs)
        {
            if(p.life > 0) continue
            p.mesh.visible = true
            p.mesh.position.set(x + (Math.random() - 0.5) * 0.22, y + 0.05, z + (Math.random() - 0.5) * 0.22)
            p.vx = (Math.random() - 0.5) * 0.7
            p.vy = 0.5 + Math.random() * 0.55
            p.vz = (Math.random() - 0.5) * 0.7
            p.life = 0.36 + Math.random() * 0.16
            spawned++
            if(spawned >= count) break
        }
    }

    _playTone(freqStart, freqEnd, duration = 0.12, gain = 0.045)
    {
        try
        {
            if(!this._audioCtx)
                this._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
            const ctx = this._audioCtx
            if(ctx.state === 'suspended') ctx.resume()
            const osc = ctx.createOscillator()
            const amp = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(freqStart, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration)
            amp.gain.setValueAtTime(gain, ctx.currentTime)
            amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
            osc.connect(amp)
            amp.connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + duration)
        }
        catch {}
    }

    jump()
    {
        if(!this.onGround) return
        this.vy = 6.3
        this.onGround = false
        this.squash = 1.22
        this.idleTime = 0
        this._spawnPuff(this.position.x, this.position.y, this.position.z, 4)
        this._playTone(390, 710, 0.12, 0.045)
    }

    meow()
    {
        this._playTone(640, 480, 0.18, 0.045)
    }

    pet()
    {
        this.petTimer = 1.2
        this.squash = 0.86
        this._playTone(420, 560, 0.20, 0.04)
        for(const h of this.hearts)
        {
            h.mesh.visible = true
            h.mesh.position.set(
                this.position.x + (Math.random() - 0.5) * 0.45,
                this.position.y + 0.75 + Math.random() * 0.25,
                this.position.z + (Math.random() - 0.5) * 0.45
            )
            h.vx = (Math.random() - 0.5) * 0.6
            h.vy = 0.9 + Math.random() * 0.8
            h.vz = (Math.random() - 0.5) * 0.6
            h.life = 0.75 + Math.random() * 0.35
        }
    }

    setTarget(x, z)
    {
        const clamped = clampToLDesk(x, z)
        this.targetPoint = new THREE.Vector2(clamped.x, clamped.z)
        this.targetRing.position.set(clamped.x, 0.038, clamped.z)
        this.targetRing.visible = true
        this.idleTime = 0
    }

    teleport(x, z)
    {
        const clamped = clampToLDesk(x, z)
        this.position.set(clamped.x, 0.6, clamped.z)
        this.velocity.set(0, 0, 0)
        this.vy = 0
        this.onGround = false
        this.targetPoint = null
        this.targetRing.visible = false
        this.idleTime = 0
        this._spawnPuff(clamped.x, 0.06, clamped.z, 6)
        this.savePosition()
        this._playTone(520, 780, 0.14, 0.045)
    }

    reset()
    {
        this.position.set(0, 0.25, 0.85)
        this.velocity.set(0, 0, 0)
        this.vy = 0
        this.onGround = false
        this.rotationY = Math.PI * 0.08
        this.targetPoint = null
        this.targetRing.visible = false
        this.idleTime = 0
        try { localStorage.removeItem(STATE_KEY) } catch {}
    }

    savePosition()
    {
        if(!Number.isFinite(this.position.x) || !Number.isFinite(this.position.z)) return
        try
        {
            localStorage.setItem(STATE_KEY, JSON.stringify({
                x: Number(this.position.x.toFixed(2)),
                z: Number(this.position.z.toFixed(2)),
                r: Number(this.rotationY.toFixed(2)),
                t: Date.now(),
            }))
        }
        catch {}
    }

    _restorePosition()
    {
        try
        {
            const raw = localStorage.getItem(STATE_KEY)
            if(!raw) return
            const data = JSON.parse(raw)
            if(data && (Date.now() - data.t) < 30 * 60 * 1000 && Number.isFinite(data.x) && Number.isFinite(data.z))
            {
                const clamped = clampToLDesk(data.x, data.z)
                this.position.set(clamped.x, 0, clamped.z)
                if(Number.isFinite(data.r)) this.rotationY = data.r
            }
        }
        catch {}
    }

    update(dt, input, elapsed, pushables = [], platforms = [], obstacles = [])
    {
        let dirX = input.x
        let dirZ = input.z

        if(Math.abs(input.x) > 0.05 || Math.abs(input.z) > 0.05)
        {
            this.targetPoint = null
            this.targetRing.visible = false
        }
        else if(this.targetPoint)
        {
            const dx = this.targetPoint.x - this.position.x
            const dz = this.targetPoint.y - this.position.z
            const dist = Math.hypot(dx, dz)
            if(dist < 0.24)
            {
                this.targetPoint = null
                this.targetRing.visible = false
            }
            else
            {
                dirX = dx / dist
                dirZ = dz / dist
                this.targetRing.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.14)
            }
        }

        const len = Math.hypot(dirX, dirZ)
        const maxSpeed = input.sprint ? 6.4 : 4.2
        if(len > 0.05)
        {
            this.idleTime = 0
            const nx = dirX / Math.max(1, len)
            const nz = dirZ / Math.max(1, len)
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, nx * maxSpeed, Math.min(1, dt * 11))
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, nz * maxSpeed, Math.min(1, dt * 11))

            const desiredAngle = Math.atan2(nx, nz)
            let diff = desiredAngle - this.rotationY
            while(diff > Math.PI) diff -= Math.PI * 2
            while(diff < -Math.PI) diff += Math.PI * 2
            this.rotationY += diff * Math.min(1, dt * 11)
        }
        else
        {
            this.idleTime += dt
            this.velocity.x *= Math.pow(0.001, dt)
            this.velocity.z *= Math.pow(0.001, dt)
        }

        // Move & enforce expanded L-desk boundary
        const next = clampToLDesk(
            this.position.x + this.velocity.x * dt,
            this.position.z + this.velocity.z * dt
        )
        this.position.x = next.x
        this.position.z = next.z

        // Solid sliding collision against desk obstacles (lamp, mug, speakers, phone, etc.)
        const catRadius = 0.34
        for(const obs of obstacles)
        {
            if(this.position.y > (obs.maxY ?? 1.2) - 0.12) continue
            const dx = this.position.x - obs.x
            const dz = this.position.z - obs.z
            const dist = Math.hypot(dx, dz)
            const minDist = catRadius + obs.r
            if(dist > 0.0001 && dist < minDist)
            {
                const push = minDist - dist
                this.position.x += (dx / dist) * push
                this.position.z += (dz / dist) * push
            }
        }
        const postObs = clampToLDesk(this.position.x, this.position.z)
        this.position.x = postObs.x
        this.position.z = postObs.z

        // Check elevated jumpable platforms (monitor riser, book stack, cat bed, tablet, cat tree shelf)
        let floorY = 0
        for(const plat of platforms)
        {
            if(
                this.position.x >= plat.minX && this.position.x <= plat.maxX &&
                this.position.z >= plat.minZ && this.position.z <= plat.maxZ &&
                this.position.y >= plat.y - 0.22
            )
            {
                floorY = Math.max(floorY, plat.y)
            }
        }
        this.groundY = floorY
        if(this.position.y > floorY + 0.01) this.onGround = false

        if(!this.onGround || this.vy !== 0)
        {
            this.vy -= 16.5 * dt
            this.position.y += this.vy * dt
            if(this.position.y <= floorY)
            {
                this.position.y = floorY
                this.vy = 0
                this.onGround = true
                this.squash = 0.84
                this._spawnPuff(this.position.x, floorY, this.position.z, 3)
            }
        }

        // Pushable desk props (yarn ball, pencils, toy mouse)
        const speed = Math.hypot(this.velocity.x, this.velocity.z)
        for(const prop of pushables)
        {
            const dx = prop.mesh.position.x - this.position.x
            const dz = prop.mesh.position.z - this.position.z
            const dist = Math.hypot(dx, dz)
            const minDist = 0.44 + prop.radius
            if(dist > 0.001 && dist < minDist && this.position.y < 0.4)
            {
                const push = (minDist - dist) * 6.5 + speed * 0.52
                prop.vx += (dx / dist) * push * dt * 8
                prop.vz += (dz / dist) * push * dt * 8
            }
        }

        // Update dust & pet sparkles
        for(const p of this.puffs)
        {
            if(p.life <= 0) continue
            p.life -= dt
            p.mesh.position.x += p.vx * dt
            p.mesh.position.y += p.vy * dt
            p.mesh.position.z += p.vz * dt
            p.mesh.scale.setScalar(Math.max(0.01, p.life * 2.1))
            p.mesh.material.opacity = Math.max(0, p.life * 1.0)
            if(p.life <= 0) p.mesh.visible = false
        }
        for(const h of this.hearts)
        {
            if(h.life <= 0) continue
            h.life -= dt
            h.mesh.position.x += h.vx * dt
            h.mesh.position.y += h.vy * dt
            h.mesh.position.z += h.vz * dt
            h.mesh.rotation.y += dt * 5
            h.mesh.scale.setScalar(Math.max(0.01, h.life * 1.3))
            h.mesh.material.opacity = Math.max(0, h.life)
            if(h.life <= 0) h.mesh.visible = false
        }

        // Smooth feline biomechanics (trot -> gallop + 2-joint knee/elbow bend!)
        this.smoothSpeed += (speed - this.smoothSpeed) * Math.min(1, dt * 10)
        const moveBlend = Math.min(1, this.smoothSpeed / 1.4)
        const gallopBlend = Math.min(1, Math.max(0, (this.smoothSpeed - 4.0) / 2.2))

        if(moveBlend > 0.02 && this.onGround)
        {
            this.walkPhase += dt * Math.min(12, 4.2 + this.smoothSpeed * 1.85)
            this.stepTimer -= dt
            if(this.stepTimer <= 0 && this.smoothSpeed > 1.2)
            {
                this.stepTimer = 0.25
                this._spawnPuff(this.position.x, this.position.y, this.position.z, 1)
            }
        }

        for(const leg of this.legs)
        {
            const phase = leg.trotPhase * (1 - gallopBlend) + leg.gallopPhase * gallopBlend
            const swing = Math.sin(this.walkPhase + phase)
            const liftWave = Math.cos(this.walkPhase + phase)

            const upperAmp = 0.44 + gallopBlend * 0.26
            const targetUpper = swing * upperAmp * moveBlend
            const bendSignal = Math.max(0, liftWave) * moveBlend
            const targetLower = leg.isFront
                ? (0.12 + bendSignal * (0.50 + gallopBlend * 0.34)) * moveBlend
                : (-0.14 - bendSignal * (0.46 + gallopBlend * 0.30)) * moveBlend
            const pawLift = Math.max(0, liftWave) * (0.045 + gallopBlend * 0.03) * moveBlend

            leg.pivot.rotation.x += (targetUpper - leg.pivot.rotation.x) * Math.min(1, dt * 14)
            leg.pivot.position.y += (leg.baseY + pawLift - leg.pivot.position.y) * Math.min(1, dt * 14)
            leg.lowerPivot.rotation.x += (targetLower - leg.lowerPivot.rotation.x) * Math.min(1, dt * 15)
        }

        // Torso bounce, breathing & squash/stretch
        this.squash = THREE.MathUtils.lerp(this.squash, 1, Math.min(1, dt * 10))
        const invSq = 1 / Math.sqrt(this.squash)
        this.bodyGroup.scale.set(invSq, this.squash, invSq)

        const breath = Math.sin(elapsed * 2.1) * 0.011 * (1 - moveBlend * 0.6)
        const strideBounce = Math.abs(Math.cos(this.walkPhase)) * (0.036 + gallopBlend * 0.04) * moveBlend
        this.bodyGroup.position.y = breath + strideBounce
        this.bodyGroup.rotation.x = Math.sin(this.walkPhase - 0.5) * (0.035 + gallopBlend * 0.065) * moveBlend

        // Scarf tail soft sway
        if(this.scarfTailPivot)
        {
            const swayX = moveBlend * 0.38 + Math.sin(elapsed * (3.2 + this.smoothSpeed)) * (0.05 + moveBlend * 0.1)
            const swayZ = 0.08 + Math.cos(elapsed * 2.8) * (0.04 + moveBlend * 0.08)
            this.scarfTailPivot.rotation.x += (swayX - this.scarfTailPivot.rotation.x) * Math.min(1, dt * 8)
            this.scarfTailPivot.rotation.z += (swayZ - this.scarfTailPivot.rotation.z) * Math.min(1, dt * 8)
        }

        // Curious head look-around & happy pet tilt
        if(this.petTimer > 0) this.petTimer = Math.max(0, this.petTimer - dt)
        const petTilt = Math.sin(this.petTimer * Math.PI * 3) * 0.18 * (this.petTimer > 0 ? 1 : 0)
        const idleLookY = Math.sin(elapsed * 0.65) * 0.26 * (1 - moveBlend)
        this.headGroup.rotation.y += (idleLookY - this.headGroup.rotation.y) * Math.min(1, dt * 6)
        this.headGroup.rotation.z += ((Math.sin(elapsed * 1.2) * 0.04 + petTilt) - this.headGroup.rotation.z) * Math.min(1, dt * 8)

        // Graceful 4-segment S-wave upward-curled tail
        for(let ti = 0; ti < this.tailSegments.length; ti++)
        {
            const seg = this.tailSegments[ti]
            const lag = ti * 0.72
            const swayZ = Math.sin(elapsed * (2.2 + moveBlend * 1.2) - lag) * (0.14 + ti * 0.045)
            const sprintFlatten = ti === 0 ? -gallopBlend * 0.25 : 0
            seg.pivot.rotation.z += (swayZ - seg.pivot.rotation.z) * Math.min(1, dt * 6)
            seg.pivot.rotation.x += ((seg.basePitch + sprintFlatten) - seg.pivot.rotation.x) * Math.min(1, dt * 5)
        }

        // Single-ear twitch
        this.earTwitchTimer -= dt
        if(this.earTwitchTimer <= 0)
        {
            this.earTwitchTimer = 2.6 + Math.random() * 4.2
            const e = this.ears[Math.random() > 0.5 ? 0 : 1]
            e.pivot.rotation.z = e.baseZ + e.side * 0.22
        }
        for(const e of this.ears)
            e.pivot.rotation.z = THREE.MathUtils.lerp(e.pivot.rotation.z, e.baseZ, Math.min(1, dt * 10))

        // Natural blinking
        this.blinkTimer -= dt
        if(this.blinkTimer <= 0)
        {
            this.isBlinking = !this.isBlinking
            this.blinkTimer = this.isBlinking ? 0.12 : 2.4 + Math.random() * 3.0
        }
        const eyeScaleY = (this.isBlinking || this.petTimer > 0.4) ? 0.12 : 1.0
        for(const eye of this.eyes)
            eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, eyeScaleY, Math.min(1, dt * 26))

        // Contact shadow tracks elevation above desk/platform
        const hAbove = Math.max(0, this.position.y - this.groundY)
        this.blobShadow.scale.setScalar(Math.max(0.45, 1 - hAbove * 0.32))
        this.blobShadow.position.y = 0.018 - hAbove

        this.group.position.copy(this.position)
        this.group.rotation.y = this.rotationY
    }
}
