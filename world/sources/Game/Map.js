import { clamp } from 'three/src/math/MathUtils.js'
import { Game } from './Game.js'

export class Map
{
    constructor()
    {
        this.game = Game.getInstance()

        this.initiated = false
        this.modal = this.game.modals.items.get('map')
        this.element = this.modal.element.querySelector('.js-map-container')

        this.setTrigger()
        this.setInputs()

        this.modal.events.on('open', () =>
        {
            if(!this.initiated)
                this.init()

            this.texture.update()
        })
    }

    init()
    {
        this.initiated = true
        
        this.setLocations()
        this.setPlayer()
        this.setTexture()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 14)
    }

    setLocations()
    {
        this.locations = {}
        this.locations.items = [
            { tr: 'Başarımlar', en: 'Achievements', respawnName: 'achievements', offset: { x: 0, y: -0.01 } },
            { tr: 'Sunak', en: 'Altar', respawnName: 'altar', offset: { x: 0, y: -0.05 } },
            { tr: 'Perde<br /> arkası', en: 'Behind the<br />scenes', respawnName: 'behindTheScene', offset: { x: 0.01, y: 0 } },
            { tr: 'Bowling', en: 'Bowling', respawnName: 'bowling', offset: { x: -0.08, y: 0.03 } },
            { tr: 'Kariyer', en: 'Career', respawnName: 'career', offset: { x: 0, y: -0.06 } },
            { tr: 'Pist', en: 'Circuit', respawnName: 'circuit', offset: { x: -0.08, y: -0.05 } },
            { tr: 'Çerez', en: 'Cookie', respawnName: 'cookie', offset: { x: -0.02, y: -0.01 } },
            { tr: 'Lab', en: 'Lab', respawnName: 'lab', offset: { x: -0.03, y: 0 } },
            { tr: 'Başlangıç', en: 'Start', respawnName: 'landing', offset: { x: 0.02, y: 0 } },
            { tr: 'Projeler', en: 'Projects', respawnName: 'projects', offset: { x: 0, y: -0.02 } },
            { tr: 'Sosyal', en: 'Social', respawnName: 'social', offset: { x: -0.01, y: -0.04 } },
            { tr: 'Klasik site', en: 'Classic site', respawnName: 'timeMachine', offset: { x: 0, y: 0 } },
        ]

        const hint = document.createElement('div')
        hint.className = 'js-map-hint map-teleport-hint'
        this.element.append(hint)

        const teleportTo = (respawnName) =>
        {
            this.game.player.respawn(respawnName, () =>
            {
                this.game.view.focusPoint.isTracking = true
                this.game.player?.savePosition?.()
            })
            this.game.modals.close()
        }

        const pinElements = []
        for(const item of this.locations.items)
        {
            const respawn = this.game.respawns.getByName(item.respawnName)
            const mapPosition = this.worldToMap(respawn.position)

            const element = document.createElement('div')
            element.classList.add('location')
            element.setAttribute('role', 'button')
            element.setAttribute('tabindex', '0')
            element.innerHTML = /* html */`
                <div class="pin"></div>
                <div class="name-container">
                    <div class="name"></div>
                </div>
            `
            element.style.left = `${(mapPosition.x + item.offset.x)* 100}%`
            element.style.top = `${(mapPosition.y + item.offset.y)* 100}%`
            element.style.zIndex = Math.round(mapPosition.y * 1000)

            this.element.append(element)
            pinElements.push({ item, element, nameEl: element.querySelector('.name') })

            element.addEventListener('click', (event) =>
            {
                event.stopPropagation()
                teleportTo(item.respawnName)
            })
            element.addEventListener('keydown', (event) =>
            {
                if(event.key === 'Enter' || event.key === ' ')
                {
                    event.preventDefault()
                    teleportTo(item.respawnName)
                }
            })
        }

        const refreshLabels = (lang) =>
        {
            const isEn = (lang || document.documentElement.lang) === 'en'
            hint.textContent = isEn ? 'Click any area on the map to teleport there' : 'Işınlanmak için haritada bir alana tıkla'
            for(const p of pinElements)
            {
                const label = isEn ? p.item.en : p.item.tr
                p.nameEl.innerHTML = label
                p.element.setAttribute('title', (isEn ? 'Teleport: ' : 'Işınlan: ') + label.replace(/<br\s*\/?>/gi, ' '))
            }
        }
        refreshLabels(document.documentElement.lang)
        window.addEventListener('world-lang-change', (e) => refreshLabels(e.detail))

        // Clicking anywhere on the map image teleports to the closest area
        this.element.addEventListener('click', (event) =>
        {
            if(event.target.closest('.location'))
                return
            const rect = this.element.getBoundingClientRect()
            if(!rect.width || !rect.height)
                return
            const mx = clamp((event.clientX - rect.left) / rect.width, 0, 1)
            const my = clamp((event.clientY - rect.top) / rect.height, 0, 1)
            const worldPos = { x: (mx - 0.5) * this.game.terrain.size, z: (my - 0.5) * this.game.terrain.size }
            const closest = this.game.respawns.getClosest(worldPos)
            if(closest)
                teleportTo(closest.name)
        })
    }
    
    setPlayer()
    {
        this.player = {}
        this.player.element = this.element.querySelector('.js-player')
        this.player.roundedPosition = { x: 0, y: 0 }
    }
    
    setTexture()
    {
        this.texture = {}
        this.texture.element = this.element.querySelector('.js-texture')
        this.texture.previousUrl = null

        this.texture.element.addEventListener('load', () =>
        {
            this.texture.element.classList.add('is-visible')
        })
        
        this.texture.update = () =>
        {
            const url = this.game.dayCycles.intervalEvents.get('night').inInterval ? 'ui/map/map-night.webp' : 'ui/map/map-day.webp'

            if(url !== this.texture.previousUrl)
            {
                this.texture.element.classList.remove('is-visible')
                this.texture.previousUrl = url
                this.texture.element.src = url
            }
        }
    }

    setTrigger()
    {
        const element = this.game.domElement.querySelector('.js-map-trigger')
        
        element.addEventListener('click', (event) =>
        {
            this.game.modals.open('map')
        })
        element.addEventListener('keydown', (event) =>
        {
            event.preventDefault()
        })
    }

    setInputs()
    {
        // Inputs keyboard
        this.game.inputs.addActions([
            { name: 'map', categories: [ 'modal', 'menu', 'wandering' ], keys: [ 'Keyboard.m', 'Keyboard.KeyM' ] },
        ])
        this.game.inputs.events.on('map', (action) =>
        {
            if(action.active)
            {
                if(!this.modal.isOpen)
                    this.game.modals.open('map')
                else
                    this.game.modals.close()
            }
        })
    }

    worldToMap(coordinates)
    {
        let x = coordinates.x
        let y = typeof coordinates.z !== 'undefined' ? coordinates.z : coordinates.y

        x /= this.game.terrain.size
        y /= this.game.terrain.size

        x += 0.5
        y += 0.5

        x = clamp(x, 0, 1)
        y = clamp(y, 0, 1)

        return { x, y }
    }

    update()
    {
        if(!this.modal.isOpen)
            return

        const playerRoundedX = Math.round(this.game.player.position.x)
        const playerRoundedY = Math.round(this.game.player.position.z)

        if(playerRoundedX !== this.player.roundedPosition.x || playerRoundedY !== this.player.roundedPosition.y)
        {
            this.player.roundedPosition.x = playerRoundedX
            this.player.roundedPosition.y = playerRoundedY

            const playerCoordinates = this.worldToMap(this.player.roundedPosition)
            const x = Math.round(playerCoordinates.x * 1000) / 10
            const y = Math.round(playerCoordinates.y * 1000) / 10

            this.player.element.style.left = `${x}%`
            this.player.element.style.top = `${y}%`
            this.player.element.style.transform = `rotate(${-this.game.physicalVehicle.yRotation}rad)`
        }
    }
}