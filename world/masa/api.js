const FALLBACK_PROJECTS = [
    {
        id: 4,
        title_tr: 'Kömür v2.4.0',
        title_en: 'Kömür v2.4.0',
        category_tr: 'macOS & Windows',
        category_en: 'macOS & Windows',
        tech_tr: 'Smokin Masaüstü Kedi · 4 Slot Gardırop',
        tech_en: 'Tuxedo Desktop Cat · 4-Slot Wardrobe',
        url: '/komur.html',
        image: '/assets/img/real/komur.jpg',
    },
    {
        id: 6,
        title_tr: 'Kırmızı Bisiklet',
        title_en: 'Selective Colour',
        category_tr: 'Grafik Tasarım',
        category_en: 'Graphic Design',
        tech_tr: 'Photoshop · Seçici Renk',
        tech_en: 'Photoshop · Selective Colour',
        url: '/kirmizi-bisiklet.html',
        image: '/assets/img/grafik-animasyon/p1-sonrasi.webp',
    },
    {
        id: 9,
        title_tr: 'Kapadokya Balonlar',
        title_en: 'Cappadocia Balloons',
        category_tr: 'Kompozisyon',
        category_en: 'Compositing',
        tech_tr: 'Smart Object · Katman Maskeleri',
        tech_en: 'Smart Object · Layer Masks',
        url: '/kapadokya-balonlar.html',
        image: '/assets/img/grafik-animasyon/p4-sonrasi.webp',
    },
    {
        id: 10,
        title_tr: 'Antalya Sahili',
        title_en: 'Antalya Coast',
        category_tr: 'Fotoğraf Düzenleme',
        category_en: 'Photo Retouching',
        tech_tr: 'Photoshop · Görüntü Temizleme',
        tech_en: 'Photoshop · Clean-up',
        url: '/antalya-sahili.html',
        image: '/assets/img/grafik-animasyon/p5-sonrasi.webp',
    },
    {
        id: 11,
        title_tr: 'Pera Müzesi',
        title_en: 'Pera Museum',
        category_tr: 'Web Arayüz Tasarımı',
        category_en: 'Web UI Layout',
        tech_tr: '960 Grid · Layer Comps',
        tech_en: '960 Grid · Layer Comps',
        url: '/pera-muzesi.html',
        image: '/assets/img/grafik-animasyon/p6-sonrasi.webp',
    },
    {
        id: 2,
        title_tr: 'Multistream Viewer',
        title_en: 'Multistream Viewer',
        category_tr: 'Masaüstü Uygulaması',
        category_en: 'Desktop App',
        tech_tr: 'Electron · JavaScript · Twitch/Kick',
        tech_en: 'Electron · JavaScript · Twitch/Kick',
        url: 'https://github.com/sushikiddo/multistream-viewer',
        image: '/assets/img/real/multistream.jpg',
    },
]

export class WorldAPI
{
    constructor()
    {
        this.online = false
        this.whispers = []
        this.leaderboard = []
        this.projects = [...FALLBACK_PROJECTS]
        this.listeners = new Set()
        this._pollId = null
    }

    onUpdate(fn)
    {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
    }

    _emit()
    {
        for(const fn of this.listeners)
        {
            try { fn(this) } catch {}
        }
    }

    async init()
    {
        await Promise.all([this.fetchWorld(), this.fetchProjects()])
        this._pollId = setInterval(() => this.fetchWorld(), 15000)
    }

    async fetchWorld()
    {
        try
        {
            const res = await fetch('/api/world', { headers: { Accept: 'application/json' } })
            const ct = res.headers.get('content-type') || ''
            if(!res.ok || !ct.includes('application/json'))
                throw new Error('offline')
            const data = await res.json()
            this.online = true
            this.whispers = Array.isArray(data.whispers) ? data.whispers : []
            this.leaderboard = Array.isArray(data.circuitLeaderboard) ? data.circuitLeaderboard : []
            this._emit()
            return true
        }
        catch
        {
            this.online = false
            this._emit()
            return false
        }
    }

    async fetchProjects()
    {
        try
        {
            const res = await fetch('/api/world-projects', { headers: { Accept: 'application/json' } })
            const ct = res.headers.get('content-type') || ''
            if(!res.ok || !ct.includes('application/json'))
                return
            const data = await res.json()
            if(Array.isArray(data.projects) && data.projects.length > 0)
            {
                this.projects = data.projects
                this._emit()
            }
        }
        catch {}
    }

    async postWhisper(message, countryCode = 'tr')
    {
        const clean = String(message || '').trim().slice(0, 60)
        if(!clean)
            return { ok: false, offline: !this.online }

        const entry = {
            id: `local-${Date.now()}`,
            message: clean,
            countrycode: countryCode,
            x: 0,
            y: 0,
            z: 0,
        }

        if(this.online)
        {
            try
            {
                const res = await fetch('/api/world', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'whisper',
                        message: clean,
                        countrycode: countryCode,
                        x: 0,
                        y: 0,
                        z: 0,
                    }),
                })
                if(res.ok)
                {
                    const data = await res.json()
                    if(Array.isArray(data.whispers))
                        this.whispers = data.whispers
                    else
                        this.whispers = [entry, ...this.whispers].slice(0, 30)
                    this._emit()
                    return { ok: true, offline: false }
                }
            }
            catch {}
        }

        this.whispers = [entry, ...this.whispers].slice(0, 30)
        this._emit()
        return { ok: true, offline: true }
    }

    async postLaserScore(tag, score, countryCode = 'tr')
    {
        const cleanTag = String(tag || 'ONR').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'ONR'
        const encodedDuration = Math.max(100, 100000 - Math.min(99, Math.max(0, score)) * 1000)
        if(this.online)
        {
            try
            {
                const res = await fetch('/api/world', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'circuit',
                        tag: cleanTag,
                        countryCode,
                        duration: encodedDuration,
                    }),
                })
                if(res.ok)
                {
                    const data = await res.json()
                    if(Array.isArray(data.circuitLeaderboard))
                        this.leaderboard = data.circuitLeaderboard
                    this._emit()
                    return { ok: true, offline: false }
                }
            }
            catch {}
        }

        this.leaderboard = [...this.leaderboard, [cleanTag, countryCode, encodedDuration]]
            .sort((a, b) => a[2] - b[2])
            .slice(0, 10)
        this._emit()
        return { ok: true, offline: true }
    }

    static decodeScore(duration)
    {
        if(duration > 30000 && duration <= 100000)
            return Math.round((100000 - duration) / 1000)
        return `${(duration / 1000).toFixed(1)}s`
    }
}
