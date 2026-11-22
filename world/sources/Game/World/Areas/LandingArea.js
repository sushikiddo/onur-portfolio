import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

export class LandingArea extends Area
{
    constructor(model)
    {
        super(model)

        this.localTime = uniform(0)

        this.setLetters()
        this.setKiosk()
        this.setControls()
        this.setBonfire()
        this.setAchievement()
    }

    setLetters()
    {
        const references = this.references.items.get('letters')
        // Harfler: ONUR CAN ORHAN (piksel yazı tipi). Modelde 10 harf var, eksik 2 harf kopyalanır.
        const glyphs = {
            O: [ '01110', '10001', '10001', '10001', '10001', '10001', '01110' ],
            N: [ '10001', '11001', '10101', '10101', '10011', '10001', '10001' ],
            U: [ '10001', '10001', '10001', '10001', '10001', '10001', '01110' ],
            R: [ '11110', '10001', '10001', '11110', '10100', '10010', '10001' ],
            H: [ '10001', '10001', '10001', '11111', '10001', '10001', '10001' ],
            A: [ '01110', '10001', '10001', '11111', '10001', '10001', '10001' ],
            C: [ '01111', '10000', '10000', '10000', '10000', '10000', '01111' ],
        }
        const text = 'ONUR CAN ORHAN'
        const step = 1.25
        const wordGap = 0.6
        const cell = 0.2

        // Özgün dizilim: soldan sağa (refLetters019 -> refLetters010)
        const ordered = [ ...references ].sort((a, b) => b.name.localeCompare(a.name))
        const first = ordered[0].position
        const last = ordered[ordered.length - 1].position
        const direction = last.clone().sub(first).setY(0).normalize()
        const center = new THREE.Vector3()
        for(const reference of ordered)
            center.add(reference.position)
        center.divideScalar(ordered.length)

        // Harf konumları (ortalanmış)
        const offsets = []
        let cursor = 0
        for(const character of text)
        {
            if(character === ' ')
            {
                cursor += wordGap
                continue
            }
            offsets.push({ character, offset: cursor })
            cursor += step
        }
        const half = (cursor - step) / 2

        const buildGeometry = (character, source) =>
        {
            const rows = glyphs[character]
            const parts = []
            for(let y = 0; y < 7; y++)
                for(let x = 0; x < 5; x++)
                {
                    if(rows[y][x] !== '1')
                        continue
                    const box = new THREE.BoxGeometry(cell, cell, 0.46)
                    box.translate((x - 2) * cell, (3 - y) * cell, 0)
                    parts.push(box)
                }
            const geometry = mergeGeometries(parts)
            for(const name in source.attributes)
            {
                if(geometry.attributes[name])
                    continue
                const attribute = source.attributes[name]
                const array = new Float32Array(geometry.attributes.position.count * attribute.itemSize)
                for(let i = 0; i < geometry.attributes.position.count; i++)
                    for(let k = 0; k < attribute.itemSize; k++)
                        array[i * attribute.itemSize + k] = attribute.array[k]
                geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize))
            }
            // UV: tüm köşelere özgün harfin ilk UV değeri (palet rengi)
            if(source.attributes.uv)
            {
                const uv = geometry.attributes.uv.array
                for(let i = 0; i < uv.length; i += 2)
                {
                    uv[i] = source.attributes.uv.array[0]
                    uv[i + 1] = source.attributes.uv.array[1]
                }
            }
            return geometry
        }

        const template = ordered[0]
        const allLetters = []
        for(let i = 0; i < offsets.length; i++)
        {
            const { character, offset } = offsets[i]
            const position = center.clone().addScaledVector(direction, offset - half)
            position.y = template.position.y

            let reference = ordered[i]
            if(reference)
            {
                reference.geometry = buildGeometry(character, reference.geometry)
                reference.position.copy(position)
                reference.userData.object.physical.body.setTranslation(position, true)
                if(reference.userData.object.physical.initialState?.position)
                {
                    reference.userData.object.physical.initialState.position.x = position.x
                    reference.userData.object.physical.initialState.position.y = position.y
                    reference.userData.object.physical.initialState.position.z = position.z
                    reference.userData.object.physical.initialState.sleeping = true
                }
            }
            else
            {
                const mesh = new THREE.Mesh(buildGeometry(character, template.geometry), template.material)
                mesh.position.copy(position)
                mesh.quaternion.copy(template.quaternion)
                this.game.objects.add(
                    { model: mesh, updateMaterials: false },
                    {
                        type: 'dynamic',
                        position: position,
                        rotation: template.quaternion,
                        friction: 0.7,
                        sleeping: true,
                        colliders: [ { shape: 'cuboid', parameters: [ 0.5, 0.7, 0.23 ], category: 'object' } ]
                    }
                )
                reference = mesh
            }
            allLetters.push(reference)
        }

        for(const reference of allLetters)
        {
            const physical = reference.userData.object.physical
            physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            physical.colliders[0].setContactForceEventThreshold(5)
            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }
    }

    setKiosk()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('kioskInteractivePoint')[0].position,
            'Harita',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('map')
                // interactivePoint.hide()
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

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    setControls()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('controlsInteractivePoint')[0].position,
            'Kontroller',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.menu.open('controls')
                interactivePoint.hide()
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

        // Menu instance
        const menuInstance = this.game.menu.items.get('controls')

        menuInstance.events.on('close', () =>
        {
            interactivePoint.show()
        })

        menuInstance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                menuInstance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                menuInstance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                menuInstance.tabs.goTo('touch')
        })
    }

    setBonfire()
    {
        const position = this.references.items.get('bonfireHashes')[0].position

        // Particles
        let particles = null
        {
            const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
    
            const count = 30
            const elevation = uniform(5)
            const positions = new Float32Array(count * 3)
            const scales = new Float32Array(count)
    
    
            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
    
                const angle = Math.PI * 2 * Math.random()
                const radius = Math.pow(Math.random(), 1.5) * 1
                positions[i3 + 0] = Math.cos(angle) * radius
                positions[i3 + 1] = Math.random()
                positions[i3 + 2] = Math.sin(angle) * radius
    
                scales[i] = 0.02 + Math.random() * 0.06
            }
            
            const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
            const scaleAttribute = instancedArray(scales, 'float').toAttribute()
    
            const material = new THREE.SpriteNodeMaterial()
            material.outputNode = emissiveMaterial.outputNode
    
            const progress = float(0).toVar()
    
            material.positionNode = Fn(() =>
            {
                const newPosition = positionAttribute.toVar()
                progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())
    
                newPosition.y.assign(progress.mul(elevation))
                newPosition.xz.addAssign(this.game.wind.direction.mul(progress))
    
                const progressHide = step(0.8, progress).mul(100)
                newPosition.y.addAssign(progressHide)
                
                return newPosition
            })()
            material.scaleNode = Fn(() =>
            {
                const progressScale = progress.remapClamp(0.5, 1, 1, 0)
                return scaleAttribute.mul(progressScale)
            })()
    
            const geometry = new THREE.CircleGeometry(0.5, 8)
    
            particles = new THREE.Mesh(geometry, material)
            particles.visible = false
            particles.position.copy(position)
            particles.count = count
            this.game.scene.add(particles)
        }

        // Hashes
        {
            const alphaNode = Fn(() =>
            {
                const baseUv = uv(1)
                const distanceToCenter = baseUv.sub(0.5).length()
    
                const voronoi = texture(
                    this.game.noises.voronoi,
                    baseUv
                ).g
    
                voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))
    
                return voronoi
            })()
    
            const material = new MeshDefaultMaterial({
                colorNode: color(0x6F6A87),
                alphaNode: alphaNode,
                hasWater: false,
                hasLightBounce: false
            })
    
            const mesh = this.references.items.get('bonfireHashes')[0]
            mesh.material = material
        }

        // Burn
        const burn = this.references.items.get('bonfireBurn')[0]
        burn.visible = false

        // Interactive point
        this.game.interactivePoints.create(
            this.references.items.get('bonfireInteractivePoint')[0].position,
            'Sıfırla',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()

                gsap.delayedCall(2, () =>
                {
                    // Bonfire
                    particles.visible = true
                    burn.visible = true
                    this.game.ticker.wait(2, () =>
                    {
                        particles.geometry.boundingSphere.center.y = 2
                        particles.geometry.boundingSphere.radius = 2
                    })

                    // Sound
                    this.game.audio.groups.get('campfire').items[0].positions.push(position)
                })
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

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1
    }
}