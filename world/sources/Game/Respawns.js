import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class Respawns
{
    constructor(defaultName = 'landing')
    {
        this.game = Game.getInstance()
        this.defaultName = defaultName

        this.setItems()
    }

    setItems()
    {
        this.items = new Map()

        for(const child of this.game.resources.respawnsReferencesModel.scene.children)
        {
            child.rotation.reorder('YXZ')

            let name = child.name.replace(/^respawn(.+)$/i, '$1')

            name = name.charAt(0).toLowerCase() + name.slice(1)

            const item = {
                name: name,
                position: new THREE.Vector3(
                    child.position.x,
                    4,
                    child.position.z
                ),
                rotation: child.rotation.y
            }

            this.items.set(name, item)
        }
    }

    getByName(name)
    {
        return this.items.get(name)
    }

    getSavedState()
    {
        if(this._savedState !== undefined)
            return this._savedState

        this._savedState = null
        try
        {
            const raw = localStorage.getItem('onur-3d-state')
            if(raw)
            {
                const data = JSON.parse(raw)
                const fresh = data && typeof data.t === 'number' && (Date.now() - data.t) < 30 * 60 * 1000
                if(fresh && Number.isFinite(data.x) && Number.isFinite(data.z) && Number.isFinite(data.rotation))
                {
                    this._savedState = {
                        name: 'resume',
                        position: new THREE.Vector3(data.x, 4, data.z),
                        rotation: data.rotation
                    }
                }
            }
        }
        catch {}

        return this._savedState
    }

    hasSavedState()
    {
        return this.getSavedState() !== null
    }

    clearSavedState()
    {
        this._savedState = null
        try { localStorage.removeItem('onur-3d-state') } catch {}
    }

    getDefault()
    {
        return this.getSavedState() || this.items.get(this.defaultName)
    }

    getClosest(position)
    {
        let closestItem = null
        let closestDistance = Infinity

        this.items.forEach((item) =>
        {
            const distance = Math.hypot(item.position.x - position.x, item.position.z - position.z)

            if(distance < closestDistance)
            {
                closestDistance = distance
                closestItem = item
            }
        })

        return closestItem
    }
}