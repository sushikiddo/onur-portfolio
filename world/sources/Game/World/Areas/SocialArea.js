import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import socialData from '../../../data/social.js'
import { InstancedGroup } from '../../InstancedGroup.js'
import { Area } from './Area.js'
import { View } from '../../View.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export class SocialArea extends Area
{
    constructor(model)
    {
        super(model)

        this.center = this.references.items.get('center')[0].position

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '👨‍🦲 Social',
                expanded: false,
            })
        }

        this.setIcons()
        this.setLinks()
        this.setFans()
        this.setOnlyFans()
        this.setStatue()
        // this.setFWA()
        this.setAchievement()
    }

    setIcons()
    {
        // Her kaide kendi simgesini taşır: GitHub, e-posta, Instagram ve 5 site sayfası simgesi
        const builders = {
            x: () => this.createAboutGeometry(),
            bluesky: () => this.createBlogGeometry(),
            twitch: () => this.createGalleryGeometry(),
            linkedIn: () => this.createContactGeometry(),
            discord: () => this.createEnglishGeometry(),
            mail: () => this.createMailGeometry(),
            youtube: () => this.createInstagramGeometry(),
        }

        for(const object of this.objects.items)
        {
            const object3D = object.visual?.object3D
            if(!object3D)
                continue

            const key = object3D.name.replace(/\.?\d+$/, '')
            const build = builders[key]
            if(!build)
                continue

            let mesh = null
            object3D.traverse(child => { if(!mesh && child.isMesh) mesh = child })
            if(!mesh)
                continue

            // Simge merkezi hepsinde aynı yükseklikte, nesnenin kendi dönüşü geri alınır
            const geometry = build()
            geometry.translate(0, 1.32 - object3D.position.y, 0)
            const rotation = object.physical ? object.physical.body.rotation() : mesh.quaternion
            geometry.applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).invert())
            geometry.computeVertexNormals()
            mesh.geometry = geometry

            if(key === 'youtube')
                object3D.name = 'instagram'
        }
    }

    static roundedRect(half, radius, halfY = half)
    {
        const shape = new THREE.Shape()
        const w = half
        const h = halfY
        const r = radius
        shape.moveTo(- w + r, - h)
        shape.lineTo(w - r, - h)
        shape.absarc(w - r, - h + r, r, - Math.PI / 2, 0, false)
        shape.lineTo(w, h - r)
        shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false)
        shape.lineTo(- w + r, h)
        shape.absarc(- w + r, h - r, r, Math.PI / 2, Math.PI, false)
        shape.lineTo(- w, - h + r)
        shape.absarc(- w + r, - h + r, r, Math.PI, Math.PI * 1.5, false)
        return shape
    }

    static extrudeShape(shape, depth, uvU)
    {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 })
        geometry.translate(0, 0, - depth / 2)
        const count = geometry.attributes.position.count
        const uv = new Float32Array(count * 2)
        for(let i = 0; i < count; i++)
        {
            uv[i * 2] = uvU
            uv[i * 2 + 1] = 0.5
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
        return geometry.index ? geometry.toNonIndexed() : geometry
    }

    createInstagramGeometry()
    {
        const depth = 0.3

        // Palet (palette.png): pembe çerçeve, şeftali halka ve nokta
        const frame = SocialArea.roundedRect(0.78, 0.3)
        frame.holes.push(SocialArea.roundedRect(0.62, 0.18))
        const ring = new THREE.Shape(); ring.absarc(0, 0, 0.38, 0, Math.PI * 2, false)
        const ringHole = new THREE.Path(); ringHole.absarc(0, 0, 0.22, 0, Math.PI * 2, true); ring.holes.push(ringHole)
        const dot = new THREE.Shape(); dot.absarc(0.43, 0.43, 0.09, 0, Math.PI * 2, false)

        const merged = mergeGeometries([
            SocialArea.extrudeShape(frame, depth, 0.672),
            SocialArea.extrudeShape(ring, depth, 0.578),
            SocialArea.extrudeShape(dot, depth, 0.578),
        ])
        merged.computeVertexNormals()
        return merged
    }

    createMailGeometry()
    {
        const depth = 0.3
        const halfX = 0.82
        const halfY = 0.58

        // Zarf: dış çerçeve + "V" kapak
        const frame = SocialArea.roundedRect(halfX, 0.1, halfY)
        frame.holes.push(SocialArea.roundedRect(halfX - 0.13, 0.04, halfY - 0.13))

        const bar = (ax, ay, bx, by, t) =>
        {
            const dx = bx - ax
            const dy = by - ay
            const length = Math.hypot(dx, dy)
            const nx = - dy / length * t / 2
            const ny = dx / length * t / 2
            const shape = new THREE.Shape()
            shape.moveTo(ax + nx, ay + ny)
            shape.lineTo(bx + nx, by + ny)
            shape.lineTo(bx - nx, by - ny)
            shape.lineTo(ax - nx, ay - ny)
            return shape
        }
        const inX = halfX - 0.1
        const inY = halfY - 0.1
        const flapLeft = bar(- inX, inY, 0, - 0.05, 0.12)
        const flapRight = bar(inX, inY, 0, - 0.05, 0.12)

        const merged = mergeGeometries([
            SocialArea.extrudeShape(frame, depth, 0.105),
            SocialArea.extrudeShape(flapLeft, depth * 0.8, 0.545),
            SocialArea.extrudeShape(flapRight, depth * 0.8, 0.545),
        ])
        merged.computeVertexNormals()
        return merged
    }

    createAboutGeometry()
    {
        // Kişi silüeti: baş + omuzlar
        const depth = 0.3
        const head = new THREE.Shape(); head.absarc(0, 0.38, 0.3, 0, Math.PI * 2, false)
        const body = new THREE.Shape()
        body.moveTo(- 0.7, - 0.78)
        body.lineTo(- 0.7, - 0.35)
        body.absarc(0, - 0.35, 0.7, Math.PI, 0, true)
        body.lineTo(0.7, - 0.78)
        body.lineTo(- 0.7, - 0.78)
        return mergeGeometries([
            SocialArea.extrudeShape(head, depth, 0.545),
            SocialArea.extrudeShape(body, depth, 0.105),
        ])
    }

    createBlogGeometry()
    {
        // Kalem: gövde + uç + silgi, 45 derece
        const depth = 0.3
        const poly = points =>
        {
            const shape = new THREE.Shape()
            points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y))
            return shape
        }
        const merged = mergeGeometries([
            SocialArea.extrudeShape(poly([[- 0.62, - 0.17], [0.38, - 0.17], [0.38, 0.17], [- 0.62, 0.17]]), depth, 0.26),
            SocialArea.extrudeShape(poly([[0.38, - 0.17], [0.85, 0], [0.38, 0.17]]), depth, 0.578),
            SocialArea.extrudeShape(poly([[0.66, - 0.05], [0.85, 0], [0.66, 0.05]]), depth * 1.3, 0.69),
            SocialArea.extrudeShape(poly([[- 0.85, - 0.17], [- 0.62, - 0.17], [- 0.62, 0.17], [- 0.85, 0.17]]), depth, 0.672),
        ])
        merged.rotateZ(Math.PI / 4)
        return merged
    }

    createGalleryGeometry()
    {
        // Fotoğraf çerçevesi + dağ + güneş
        const depth = 0.3
        const frame = SocialArea.roundedRect(0.78, 0.1, 0.62)
        frame.holes.push(SocialArea.roundedRect(0.64, 0.04, 0.48))
        const mountain = new THREE.Shape()
        ;[[- 0.58, - 0.44], [- 0.15, 0.12], [0.08, - 0.2], [0.22, - 0.02], [0.58, - 0.44]].forEach(([x, y], i) => i ? mountain.lineTo(x, y) : mountain.moveTo(x, y))
        const sun = new THREE.Shape(); sun.absarc(0.38, 0.22, 0.12, 0, Math.PI * 2, false)
        return mergeGeometries([
            SocialArea.extrudeShape(frame, depth, 0.45),
            SocialArea.extrudeShape(mountain, depth * 0.7, 0.293),
            SocialArea.extrudeShape(sun, depth * 0.7, 0.26),
        ])
    }

    createContactGeometry()
    {
        // Konuşma balonu + üç nokta
        const depth = 0.3
        const outline = new THREE.Shape()
        const r = 0.25, w = 0.75, h = 0.5
        outline.moveTo(- w + r, - h)
        outline.lineTo(- 0.3, - h)
        outline.lineTo(- 0.55, - 0.8)
        outline.lineTo(- 0.1, - h)
        outline.lineTo(w - r, - h)
        outline.absarc(w - r, - h + r, r, - Math.PI / 2, 0, false)
        outline.lineTo(w, h - r)
        outline.absarc(w - r, h - r, r, 0, Math.PI / 2, false)
        outline.lineTo(- w + r, h)
        outline.absarc(- w + r, h - r, r, Math.PI / 2, Math.PI, false)
        outline.lineTo(- w, - h + r)
        outline.absarc(- w + r, - h + r, r, Math.PI, Math.PI * 1.5, false)
        const parts = [SocialArea.extrudeShape(outline, depth, 0.105)]
        for(const x of [- 0.35, 0, 0.35])
        {
            const dot = new THREE.Shape(); dot.absarc(x, 0, 0.1, 0, Math.PI * 2, false)
            parts.push(SocialArea.extrudeShape(dot, depth * 1.4, 0.545))
        }
        return mergeGeometries(parts)
    }

    createEnglishGeometry()
    {
        // "EN" harfleri, piksel (blok) yöntemi
        const letters = [
            ['111', '100', '111', '100', '111'],
            ['1001', '1101', '1011', '1001', '1001'],
        ]
        const cell = 0.2
        const gap = 1
        const widths = letters.map(rows => rows[0].length)
        const totalCells = widths.reduce((a, b) => a + b, 0) + gap * (letters.length - 1)
        const parts = []
        let offset = - totalCells * cell / 2
        letters.forEach((rows, li) =>
        {
            rows.forEach((row, ry) =>
            {
                for(let cx = 0; cx < row.length; cx++)
                {
                    if(row[cx] !== '1')
                        continue
                    const box = new THREE.BoxGeometry(cell, cell, 0.3)
                    box.translate(offset + (cx + 0.5) * cell, (2 - ry) * cell, 0)
                    const count = box.attributes.position.count
                    const uv = new Float32Array(count * 2)
                    for(let i = 0; i < count; i++) { uv[i * 2] = 0.105; uv[i * 2 + 1] = 0.5 }
                    box.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
                    parts.push(box.toNonIndexed())
                }
            })
            offset += (widths[li] + gap) * cell
        })
        return mergeGeometries(parts)
    }

    setLinks()
    {
        const radius = 6
        const step = Math.PI / 7

        // Her bağlantı kendi simgesinin kaidesinin açısına yerleşir
        const slotByName = { 'Hakkımda': 0, 'Blog': 1, 'Instagram': 2, 'E-posta': 3, 'Galeri': 4, 'GitHub': 5, 'İletişim': 6, 'English': 7 }

        for(const link of socialData)
        {
            const slot = slotByName[link.name]
            const angle = slot * step
            const position = this.center.clone()
            position.x += Math.cos(angle) * radius
            position.y = 1
            position.z -= Math.sin(angle) * radius
            const align = Math.cos(angle) >= 0 ? InteractivePoints.ALIGN_RIGHT : InteractivePoints.ALIGN_LEFT

            this.interactivePoint = this.game.interactivePoints.create(
                position,
                link.name,
                align,
                InteractivePoints.STATE_CONCEALED,
                () =>
                {
                    if(link.url)
                        this.game.modals.openPage(link.url, link.name)
                    else if(link.modal)
                        this.game.modals.open(link.modal)
                },
                () =>
                {
                    this.game.inputs.interactiveButtons.addItems(['interact'])
                },
                () =>
                {
                    this.game.inputs.interactiveButtons.removeItems(['interact'])
                },
                () =>
                {
                    this.game.inputs.interactiveButtons.removeItems(['interact'])
                }
            )
        }
    }

    setFans()
    {
        const baseFan = this.references.items.get('fan')[0]
        baseFan.castShadow = true
        baseFan.receiveShadow = true

        baseFan.position.set(0, 0, 0)

        // Update materials 
        this.game.materials.updateObject(baseFan)

        baseFan.removeFromParent()
        
        this.fans = {}
        this.fans.spawnerPosition = this.references.items.get('onlyFans')[0].position
        this.fans.count = 30
        this.fans.visibleCount = 0
        this.fans.currentIndex = 0
        this.fans.mass = 0.02
        this.fans.objects = []

        const references = []

        for(let i = 0; i < this.fans.count; i++)
        {
            // Reference
            const reference = new THREE.Object3D()

            reference.position.copy(this.fans.spawnerPosition)
            reference.position.y += 99
            reference.needsUpdate = true
            references.push(reference)
            
            // Object
            const object = this.game.objects.add(
                {
                    model: reference,
                    updateMaterials: false,
                    castShadow: false,
                    receiveShadow: false,
                    parent: null,
                },
                {
                    type: 'dynamic',
                    position: reference.position,
                    rotation: reference.quaternion,
                    friction: 0.7,
                    mass: this.fans.mass,
                    sleeping: true,
                    enabled: false,
                    colliders: [ { shape: 'cuboid', parameters: [ 0.45, 0.65, 0.45 ], category: 'object' } ],
                    waterGravityMultiplier: - 1
                },
            )

            this.fans.objects.push(object)
        }

        this.fans.instancedGroup = new InstancedGroup(references, baseFan)

        this.fans.pop = () =>
        {
            const object = this.fans.objects[this.fans.currentIndex]

            const spawnPosition = this.fans.spawnerPosition.clone()
            spawnPosition.x += (Math.random() - 0.5) * 4
            spawnPosition.y += 4 * Math.random()
            spawnPosition.z += (Math.random() - 0.5) * 4
            object.physical.body.setTranslation(spawnPosition)
            object.physical.body.setEnabled(true)
            object.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
            object.physical.body.setAngvel({ x: 0, y: 0, z: 0 })
            object.physical.body.wakeUp()
            // this.game.ticker.wait(1, () =>
            // {
            //     object.physical.body.applyImpulse({
            //         x: (Math.random() - 0.5) * this.fans.mass * 2,
            //         y: Math.random() * this.fans.mass * 3,
            //         z: this.fans.mass * 7
            //     }, true)
            //     object.physical.body.applyTorqueImpulse({ x: 0, y: 0, z: 0 }, true)
            // })

            this.fans.currentIndex = (this.fans.currentIndex + 1) % this.fans.count

            this.fans.visibleCount = Math.min(this.fans.visibleCount + 1, this.fans.count)

            // Sound
            this.game.audio.groups.get('click').play(true)

            // Achievement
            this.game.achievements.setProgress('fan', 1)
        }
    }

    setOnlyFans()
    {
        const interactiveArea = this.game.interactivePoints.create(
            this.references.items.get('onlyFans')[0].position,
            'Beğen',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.fans.pop()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setStatue()
    {
        this.statue = {}
        this.statue.body = this.references.items.get('statue')[0].userData.object.physical.body
        this.statue.down = false
    }

    setFWA()
    {
        this.fwa = {}

        // Confetti
        let i = 0
        this.fwa.positions = [
            new THREE.Vector3(23.5, 0, -18.5),
            new THREE.Vector3(27, 0, -19.5),
        ]
        const pop = () =>
        {
            i++
            const position = this.fwa.positions[i % this.fwa.positions.length]
            this.game.world.confetti.pop(position)
            
            setTimeout(pop, 500 + Math.random() * 1500)
        }
        setTimeout(pop, 2000)
        
        // Interactive points
        game.interactivePoints.temporaryHide()

        // Input => start
        this.game.inputs.addActions([
            { name: 'startFWA', categories: [ 'intro', 'modal', 'menu', 'racing', 'cinematic', 'wandering' ], keys: [ 'Keyboard.k' ] },
            { name: 'winFWA', categories: [ 'intro', 'modal', 'menu', 'racing', 'cinematic', 'wandering' ], keys: [ 'Keyboard.j' ] },
        ])
        this.game.inputs.events.on('startFWA', (action) =>
        {
            if(action.active)
            {
                // View
                game.view.zoom.baseRatio = 0.55
                game.view.zoom.ratio = 0.55
                game.view.zoom.smoothedRatio = 0.55
                game.view.focusPoint.position.set(25, 0, -19.2)
                game.view.focusPoint.isTracking = false
                window.setTimeout(() =>
                {
                    this.game.view.setMode(View.MODE_FREE)
                }, 1000)

                // Weather
                this.game.weather.override.start(
                    {
                        humidity: 0,
                        electricField: 0,
                        clouds: 0,
                        wind: 0
                    },
                    0
                )
        
                // Day cycles
                this.game.dayCycles.override.start(
                    {
                        progress: 0.87
                    },
                    0
                )
                
                // Buttons
                document.querySelector('.js-menu-trigger').style.display = 'none'
                document.querySelector('.js-map-trigger').style.display = 'none'
            }
        })
        this.game.inputs.events.on('winFWA', (action) =>
        {
            if(action.active)
            {
                this.game.achievements.setProgress('foty', 1)
            }
        })
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'social')
        })
    }

    update()
    {
        if(this.fans.visibleCount)
        {
            let allFansSleeping = true
            for(const fan of this.fans.objects)
                allFansSleeping = allFansSleeping && fan.physical.body.isSleeping()

            if(!allFansSleeping)
                this.fans.instancedGroup.updateBoundings()
        }
    
        if(this.statue && !this.statue.down && !this.statue.body.isSleeping())
        {
            const statueUp = new THREE.Vector3(0, 1, 0)
            statueUp.applyQuaternion(this.statue.body.rotation())
            if(statueUp.y < 0.25)
            {
                this.statue.down = true
                this.game.achievements.setProgress('statueDown', 1)
            }
        }

        for(const object of this.fans.objects)
        {
            if(!object.physical.body.isSleeping() && object.physical.body.isEnabled())
                object.visual.object3D.needsUpdate = true
        }
    }
}