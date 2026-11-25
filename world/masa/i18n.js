const LANG_KEY = 'portfolio-world-lang'

// Expanded L-shaped studio desk coordinates
// Main desk: x [-8.2..8.2], z [-3.8..4.0]
// Right L-wing: x [4.2..9.4], z [3.4..7.6]
export const MAP_BOUNDS = { minX: -8.4, maxX: 9.6, minZ: -3.9, maxZ: 7.7 }

export const STATIONS = [
    {
        id: 'projects',
        pos: [0, 0, -1.55],
        labelPos: [0, 3.25, -2.95],
        tr: 'Projeler',
        en: 'Projects',
        urlTr: '/projeler.html',
        urlEn: '/en/projects.html',
        accent: '#f59e42',
    },
    {
        id: 'about',
        pos: [-5.3, 0, -1.65],
        labelPos: [-5.6, 2.7, -2.95],
        tr: 'Hakkımda',
        en: 'About',
        urlTr: '/hakkimda.html',
        urlEn: '/en/about.html',
        accent: '#60a5fa',
    },
    {
        id: 'gallery',
        pos: [-4.75, 0, 2.15],
        labelPos: [-4.95, 1.35, 2.55],
        tr: 'Galeri',
        en: 'Gallery',
        urlTr: '/galeri.html',
        urlEn: '/en/gallery.html',
        accent: '#f472b6',
    },
    {
        id: 'blog',
        pos: [-1.45, 0, 2.35],
        labelPos: [-1.45, 1.25, 2.85],
        tr: 'Blog',
        en: 'Blog',
        urlTr: '/blog.html',
        urlEn: '/en/blog.html',
        accent: '#a78bfa',
    },
    {
        id: 'komur',
        pos: [3.45, 0, -1.55],
        labelPos: [3.65, 2.05, -2.55],
        tr: 'Kömür v2.4',
        en: 'Kömür v2.4',
        urlTr: '/komur.html',
        urlEn: '/en/komur.html',
        accent: '#dfe644',
    },
    {
        id: 'design',
        pos: [5.95, 0, 3.85],
        labelPos: [6.45, 1.65, 4.95],
        tr: 'Grafik & Tasarım',
        en: 'Graphic Design',
        urlTr: '/kirmizi-bisiklet.html',
        urlEn: '/en/selective-colour.html',
        accent: '#fb7185',
    },
    {
        id: 'contact',
        pos: [5.45, 0, 1.25],
        labelPos: [6.45, 1.75, 1.35],
        tr: 'İletişim',
        en: 'Contact',
        urlTr: '/iletisim.html',
        urlEn: '/en/contact.html',
        accent: '#2dd4bf',
    },
]

export const COPY = {
    tr: {
        title: "Kömür'ün Masası — Onur Can Orhan",
        introEyebrow: '3D İNTERAKTİF STÜDYO · ANTALYA',
        introTitle: "Kömür'ün Masasına Hoş Geldin",
        introDesc: 'Ben Onur Can Orhan. Smokin kedim Kömür ile geniş çalışma masamda dolaş; kitaplara, kedi yatağına ve kedi kulesine zıpla, projelerimi ve tasarımlarımı keşfet.',
        introStart: '🐾 Kömür ile Keşfet',
        introClassic: 'Klasik Siteye Geç',
        introHint: 'WASD / Oklar · Shift koş · Space zıpla · C kamera · Sürükle/Zoom · Tıkla-Git',
        online: 'Çevrimiçi',
        offline: 'Çevrimdışı',
        camTitle: 'Kamera Modu (Genel / Yakın Kömür)',
        lampTitle: 'Işık Modu (Akşam / Gece / Gündüz)',
        laserTitle: 'Lazer Avı Mini Oyunu (30 sn)',
        noteTitle: 'Monitöre Post-it Bırak',
        mapTitle: 'Stüdyo Masa Haritası & Işınlan',
        resetTitle: "Masayı ve Kömür'ü Sıfırla",
        classicLink: 'Klasik Site',
        fullPage: 'Tam sayfa ↗',
        themeToggle: 'Tema değiştir',
        close: 'Kapat',
        controlsHint: 'WASD · Shift Koş · Space Zıpla · E Aç · C Kamera · Tıkla-Git',
        interactBtn: 'Aç',
        jumpBtn: 'Zıpla',
        laserStart: 'Kırmızı lazeri yakala!',
        laserScore: 'Skor',
        laserTime: 'Süre',
        laserStop: 'Bitir',
        laserDoneTitle: 'Lazer Avı Bitti!',
        laserDoneSub: '30 saniyede yakaladığın lazer sayısı:',
        laserTop10: 'Günlük En İyi 10',
        laserNoScores: 'Henüz skor yok — ilk sen ol!',
        laserTagPlaceholder: '3 harf (örn. ONR)',
        laserSubmit: 'Skoru Kaydet',
        laserAgain: 'Tekrar Oyna',
        noteModalTitle: 'Monitöre Post-it Bırak',
        noteModalSub: 'Bıraktığın not 3D monitörün dış çerçevesine yapışır ve tüm ziyaretçilere görünür.',
        notePlaceholder: 'Kısa bir not yaz (maks. 60 karakter)...',
        noteSend: 'Yapıştır',
        noteListTitle: 'Son Yapışkan Notlar',
        noteEmpty: 'Henüz not bırakılmamış.',
        mapModalTitle: 'Stüdyo Masa Haritası',
        mapModalSub: "Kömür'ü ışınlamak için L-masada herhangi bir yere veya etikete tıkla:",
        lampModes: { evening: 'Akşam', night: 'Gece', day: 'Gündüz' },
        toastReset: 'Masa ve Kömür sıfırlandı!',
        toastCamClose: 'Kamera: Yakın Kömür Modu 🐾',
        toastCamWide: 'Kamera: Geniş Stüdyo Modu',
        toastPet: 'Mırrr... Kömür sevildi! 💛',
        toastNoteSaved: 'Post-it monitöre yapıştırıldı!',
        toastNoteOffline: 'Yerel modda not monitöre eklendi.',
        toastScoreSaved: 'Skorun sıralamaya eklendi!',
    },
    en: {
        title: "Kömür's Desk — Onur Can Orhan",
        introEyebrow: '3D INTERACTIVE STUDIO · ANTALYA',
        introTitle: "Welcome to Kömür's Desk",
        introDesc: "I'm Onur Can Orhan. Explore my expanded studio desk as my tuxedo cat Kömür — jump onto books, the cat bed, and scratching tower while browsing my projects and designs.",
        introStart: '🐾 Explore as Kömür',
        introClassic: 'Open Classic Site',
        introHint: 'WASD / Arrows · Shift sprint · Space jump · C camera · Drag/Zoom · Click-to-Go',
        online: 'Online',
        offline: 'Offline',
        camTitle: 'Camera Mode (Wide / Kömür Close-Up)',
        lampTitle: 'Lighting (Evening / Night / Day)',
        laserTitle: 'Laser Hunt Mini-Game (30s)',
        noteTitle: 'Stick a Post-it on the Monitor',
        mapTitle: 'Studio Desk Map & Teleport',
        resetTitle: 'Reset Desk & Kömür',
        classicLink: 'Classic Site',
        fullPage: 'Full page ↗',
        themeToggle: 'Toggle theme',
        close: 'Close',
        controlsHint: 'WASD · Shift Sprint · Space Jump · E Open · C Camera · Click-to-Go',
        interactBtn: 'Open',
        jumpBtn: 'Jump',
        laserStart: 'Catch the red laser!',
        laserScore: 'Score',
        laserTime: 'Time',
        laserStop: 'Stop',
        laserDoneTitle: 'Laser Hunt Complete!',
        laserDoneSub: 'Laser dots caught in 30 seconds:',
        laserTop10: 'Daily Top 10',
        laserNoScores: 'No scores yet — be the first!',
        laserTagPlaceholder: '3 letters (e.g. ONR)',
        laserSubmit: 'Save Score',
        laserAgain: 'Play Again',
        noteModalTitle: 'Stick a Post-it Note',
        noteModalSub: 'Your note sticks cleanly onto the 3D monitor bezel for every visitor to see.',
        notePlaceholder: 'Write a short note (max 60 chars)...',
        noteSend: 'Stick It',
        noteListTitle: 'Recent Sticky Notes',
        noteEmpty: 'No sticky notes yet.',
        mapModalTitle: 'Studio Desk Map',
        mapModalSub: 'Click any pin or anywhere on the L-desk to teleport Kömür:',
        lampModes: { evening: 'Evening', night: 'Night', day: 'Day' },
        toastReset: 'Desk & Kömür reset!',
        toastCamClose: 'Camera: Kömür Close-Up 🐾',
        toastCamWide: 'Camera: Wide Studio View',
        toastPet: 'Purrr... Kömür loves pets! 💛',
        toastNoteSaved: 'Post-it stuck to the monitor!',
        toastNoteOffline: 'Local mode: note added to the monitor.',
        toastScoreSaved: 'Score saved to leaderboard!',
    },
}

export function getLang()
{
    try
    {
        const p = new URLSearchParams(window.location.search).get('lang')
        if(p === 'en' || p === 'tr')
        {
            localStorage.setItem(LANG_KEY, p)
            return p
        }
        if(localStorage.getItem(LANG_KEY) === 'en')
            return 'en'
    }
    catch {}
    return 'tr'
}

export function setLang(lang)
{
    const next = lang === 'en' ? 'en' : 'tr'
    document.documentElement.lang = next
    try { localStorage.setItem(LANG_KEY, next) } catch {}
    return next
}

export function stationLabel(station, lang)
{
    return lang === 'en' ? station.en : station.tr
}

export function stationUrl(station, lang)
{
    return lang === 'en' ? station.urlEn : station.urlTr
}
