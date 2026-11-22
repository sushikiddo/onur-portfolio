import msgpack from 'msgpack-lite'
import { v4 as uuidv4 } from 'uuid'
import { Events } from './Events.js'
import { Game } from './Game.js'

export class Server
{
    constructor()
    {
        this.game = Game.getInstance()

        // Unique session ID
        this.uuid = localStorage.getItem('uuid')
        if(!this.uuid)
        {
            this.uuid = uuidv4()
            localStorage.setItem('uuid', this.uuid)
        }

        this.connected = false
        this.initData = null
        this.mode = import.meta.env.VITE_SERVER_URL ? 'ws' : 'http'
        this.knownWhisperIds = new Set()
        this.events = new Events()
        document.documentElement.classList.add('is-server-offline')
    }

    start()
    {
        if(this.mode === 'ws')
        {
            this.connectWs()
            setInterval(() =>
            {
                if(!this.connected)
                    this.connectWs()
            }, 2000)
        }
        else
        {
            this.connectHttp()
            setInterval(() =>
            {
                if(!document.hidden)
                    this.pollHttp()
            }, 15000)
        }
    }

    async connectHttp()
    {
        try
        {
            const response = await fetch('/api/world', { cache: 'no-store' })
            if(!response.ok)
                return
            const data = await response.json()
            if(!data || data.type !== 'init')
                return

            this.connected = true
            this.initData = data
            this.knownWhisperIds = new Set((data.whispers || []).map(w => w.id))
            document.documentElement.classList.remove('is-server-offline')
            document.documentElement.classList.add('is-server-online')
            this.events.trigger('connected')
            this.events.trigger('message', [ data ])
        }
        catch {}
    }

    async pollHttp()
    {
        if(!this.connected)
        {
            await this.connectHttp()
            return
        }
        try
        {
            const response = await fetch('/api/world', { cache: 'no-store' })
            if(!response.ok)
                return
            const data = await response.json()
            if(!data || data.type !== 'init')
                return

            this.initData = data
            this.events.trigger('message', [ { type: 'circuitUpdate', circuitLeaderboard: data.circuitLeaderboard } ])
            this.events.trigger('message', [ { type: 'cookiesUpdate', cookiesCount: data.cookiesCount } ])
            this.events.trigger('message', [ {
                type: 'cataclysmUpdate',
                cataclysmCount: data.cataclysmCount,
                cataclysmProgress: data.cataclysmProgress,
                cataclysmRunning: data.cataclysmRunning
            } ])

            const nextIds = new Set((data.whispers || []).map(w => w.id))
            const added = (data.whispers || []).filter(w => !this.knownWhisperIds.has(w.id))
            const removed = [...this.knownWhisperIds].filter(id => !nextIds.has(id)).map(id => ({ id }))
            this.knownWhisperIds = nextIds

            if(added.length)
                this.events.trigger('message', [ { type: 'whispersInsert', whispers: added } ])
            if(removed.length)
                this.events.trigger('message', [ { type: 'whispersDelete', whispers: removed } ])
        }
        catch {}
    }

    connectWs()
    {
        this.socket = new WebSocket(import.meta.env.VITE_SERVER_URL)
        this.socket.binaryType = 'arraybuffer'

        this.socket.addEventListener('open', () =>
        {
            this.connected = true
            document.documentElement.classList.remove('is-server-offline')
            document.documentElement.classList.add('is-server-online')
            this.events.trigger('connected')

            this.socket.addEventListener('message', (message) =>
            {
                this.onReceive(message)
            })

            if(this.game.ticker.elapsed > 10)
            {
                const html = /* html */`
                    <div class="top">
                        <div class="title">Sunucuya bağlandı</div>
                    </div>
                `
                this.game.notifications.show(html, 'server-connected', 8, null, 'server-connected')
            }

            this.socket.addEventListener('close', () =>
            {
                document.documentElement.classList.add('is-server-offline')
                document.documentElement.classList.remove('is-server-online')
                this.connected = false

                const html = /* html */`
                    <div class="top">
                        <div class="title">Sunucu bağlantısı kesildi</div>
                    </div>
                `
                this.game.notifications.show(html, 'server-disconnected', 8, null, 'server-disconnected')
                this.events.trigger('disconnected')
            })
        })
    }

    onReceive(message)
    {
        const data = this.decode(message.data)
        if(this.initData === null)
            this.initData = data
        this.events.trigger('message', [ data ])
    }

    send(message)
    {
        if(!this.connected)
            return false

        if(this.mode === 'ws')
        {
            this.socket.send(this.encode({ uuid: this.uuid, ...message }))
            return true
        }

        fetch('/api/world', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: this.uuid, ...message })
        })
            .then(r => r.ok ? r.json() : null)
            .then(data =>
            {
                if(!data)
                    return
                if(data.type === 'whispersInsert' && Array.isArray(data.whispers))
                    data.whispers.forEach(w => this.knownWhisperIds.add(w.id))
                this.events.trigger('message', [ data ])
            })
            .catch(() => {})
        return true
    }

    decode(data)
    {
        return msgpack.decode(new Uint8Array(data))
    }

    encode(data)
    {
        return msgpack.encode(data)
    }
}
