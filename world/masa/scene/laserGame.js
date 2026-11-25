import * as THREE from 'three'

export class LaserGame
{
    constructor(scene, onStateChange, onFinish)
    {
        this.scene = scene
        this.onStateChange = onStateChange
        this.onFinish = onFinish

        this.active = false
        this.score = 0
        this.timeLeft = 30
        this.dotPos = new THREE.Vector3(0, 0.036, 0.4)
        this.sparks = []

        this._buildVisuals()
    }

    _buildVisuals()
    {
        this.group = new THREE.Group()
        this.group.visible = false

        const core = new THREE.Mesh(
            new THREE.CircleGeometry(0.11, 22),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.25, 0.4) })
        )
        core.rotation.x = -Math.PI * 0.5
        this.group.add(core)

        const halo = new THREE.Mesh(
            new THREE.RingGeometry(0.12, 0.26, 26),
            new THREE.MeshBasicMaterial({
                color: 0xff4d6d,
                transparent: true,
                opacity: 0.60,
                side: THREE.DoubleSide,
                depthWrite: false,
            })
        )
        halo.rotation.x = -Math.PI * 0.5
        this.halo = halo
        this.group.add(halo)

        this.light = new THREE.PointLight(0xff2a4b, 2.0, 2.5)
        this.light.position.y = 0.25
        this.group.add(this.light)

        this.scene.add(this.group)

        const sparkGeo = new THREE.OctahedronGeometry(0.055, 0)
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xdfe644 })
        for(let i = 0; i < 16; i++)
        {
            const mesh = new THREE.Mesh(sparkGeo, sparkMat)
            mesh.visible = false
            this.scene.add(mesh)
            this.sparks.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 })
        }
    }

    start()
    {
        this.active = true
        this.score = 0
        this.timeLeft = 30
        this.group.visible = true
        this._spawnDot()
        this.onStateChange?.(this)
    }

    stop(silent = false)
    {
        const finalScore = this.score
        const wasActive = this.active
        this.active = false
        this.group.visible = false
        this.onStateChange?.(this)
        if(wasActive && !silent)
            this.onFinish?.(finalScore)
    }

    _spawnDot()
    {
        // Spawn across both the expanded main desk and the right L-wing!
        let x = 0
        let z = 0
        for(let tries = 0; tries < 10; tries++)
        {
            if(Math.random() < 0.28)
            {
                // Right L-wing zone
                x = 4.9 + Math.random() * 2.2
                z = 2.6 + Math.random() * 3.1
            }
            else
            {
                // Open main desk & mat zone
                x = (Math.random() - 0.5) * 8.4
                z = -0.3 + Math.random() * 3.1
            }
            if(Math.hypot(x - this.dotPos.x, z - this.dotPos.z) > 2.1)
                break
        }
        this.dotPos.set(x, 0.036, z)
        this.group.position.copy(this.dotPos)
    }

    _burst(pos)
    {
        for(const s of this.sparks)
        {
            s.mesh.visible = true
            s.mesh.position.set(pos.x, 0.14, pos.z)
            const a = Math.random() * Math.PI * 2
            const spd = 1.6 + Math.random() * 2.5
            s.vx = Math.cos(a) * spd
            s.vy = 2.2 + Math.random() * 2.2
            s.vz = Math.sin(a) * spd
            s.life = 0.45 + Math.random() * 0.22
        }
    }

    update(dt, cat, elapsed)
    {
        for(const s of this.sparks)
        {
            if(s.life <= 0) continue
            s.life -= dt
            s.vy -= 9 * dt
            s.mesh.position.x += s.vx * dt
            s.mesh.position.y = Math.max(0.03, s.mesh.position.y + s.vy * dt)
            s.mesh.position.z += s.vz * dt
            s.mesh.scale.setScalar(Math.max(0.01, s.life * 2))
            if(s.life <= 0) s.mesh.visible = false
        }

        if(!this.active) return

        this.timeLeft = Math.max(0, this.timeLeft - dt)
        this.halo.scale.setScalar(1 + Math.sin(elapsed * 14) * 0.22)

        const dist = Math.hypot(cat.position.x - this.dotPos.x, cat.position.z - this.dotPos.z)
        if(dist < 0.62)
        {
            this.score++
            this._burst(this.dotPos)
            cat.meow()
            this._spawnDot()
            this.onStateChange?.(this)
        }
        else
        {
            this.onStateChange?.(this)
        }

        if(this.timeLeft <= 0) this.stop(false)
    }
}
