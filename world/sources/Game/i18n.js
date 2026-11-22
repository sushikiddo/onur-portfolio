const LANG_KEY = 'portfolio-world-lang'

const QUICK_NAV = {
    tr: [
        { href: '/hakkimda.html', label: 'Hakkımda' },
        { href: '/projeler.html', label: 'Projeler' },
        { href: '/blog.html', label: 'Blog' },
        { href: '/galeri.html', label: 'Galeri' },
        { href: '/iletisim.html', label: 'İletişim' },
    ],
    en: [
        { href: '/en/about.html', label: 'About' },
        { href: '/en/projects.html', label: 'Projects' },
        { href: '/en/blog.html', label: 'Blog' },
        { href: '/en/gallery.html', label: 'Gallery' },
        { href: '/en/contact.html', label: 'Contact' },
    ]
}

const LABELS_EN = {
    'Başarımlar': 'Achievements',
    'Perde arkası': 'Behind the scenes',
    'Yeniden başlat': 'Restart',
    'Tamponlar': 'Bumpers',
    'Şarkıyı değiştir': 'Change track',
    'Yarışı başlat!': 'Start race!',
    'Çerezi kabul et': 'Accept cookie',
    'Sürpriz': 'Surprise',
    'Laboratuvar': 'Lab',
    'Harita': 'Map',
    'Kontroller': 'Controls',
    'Sıfırla': 'Reset',
    'Projeler': 'Projects',
    'Beğen': 'Like',
    'Klasik site': 'Classic site',
    'Hakkımda': 'About',
    'Galeri': 'Gallery',
    'İletişim': 'Contact',
    'E-posta': 'Email',
    'English': 'Turkish',
}

export function translateLabel(text, lang = document.documentElement.lang)
{
    if(lang === 'en' && Object.prototype.hasOwnProperty.call(LABELS_EN, text))
        return LABELS_EN[text]
    return text
}

const TEXT_MAP = [
    ['.home-content .title', "Onur'un dünyası", "Onur's world"],
    ['.home-content p.text:nth-of-type(1)', 'Hoş geldin!', 'Welcome!'],
    ['.home-content p.text:nth-of-type(2)', 'Ben Onur Can Orhan. Masaüstü uygulamaları, oyunlar ve web siteleri yapıyorum.', "I'm Onur Can Orhan. I build desktop apps, games, and websites."],
    ['.home-content p.text:nth-of-type(3)', 'Burası benim portfolyom. Arabayla gezip projelerimi, yazılarımı ve hakkımdaki her şeyi keşfedebilirsin.', 'This is my portfolio. Drive around to explore my projects, notes, and everything about me.'],
    ['.options-content .title', 'Ayarlar', 'Options'],
    ['.options-content table tr:nth-child(1) td:first-child', 'Ses', 'Audio'],
    ['.options-content table tr:nth-child(2) td:first-child', 'Kalite', 'Quality'],
    ['.options-content table tr:nth-child(3) td:first-child', 'Sıkıştım!', 'Stuck!'],
    ['.options-content table tr:nth-child(4) td:first-child', 'Sıfırla', 'Reset'],
    ['.options-content table tr:nth-child(5) td:first-child', 'Çizim', 'Renderer'],
    ['.options-content table tr:nth-child(6) td:first-child', 'Sunucu', 'Server'],
    ['.controls-content [data-tabs-name="mouse-keyboard"] .label', 'Fare Klavye', 'Mouse & Keyboard'],
    ['.controls-content [data-tabs-name="touch"] .label', 'Mobil Tablet', 'Mobile & Tablet'],
    ['.controls-content [data-tabs-name="gamepad"] .label', 'Oyun kolu', 'Gamepad'],
    ['.controls-content .mouse-keyboard tr:nth-child(1) td:last-child', 'Hareket et', 'Drive'],
    ['.controls-content .mouse-keyboard tr:nth-child(2) td:last-child', 'Hızlan', 'Boost'],
    ['.controls-content .mouse-keyboard tr:nth-child(3) td:last-child', 'Fren', 'Brake'],
    ['.controls-content .mouse-keyboard tr:nth-child(4) td:last-child', 'Zıpla', 'Jump'],
    ['.controls-content .mouse-keyboard tr:nth-child(5) td:last-child', 'Etkileşim', 'Interact'],
    ['.controls-content .mouse-keyboard tr:nth-child(6) td:last-child', 'Harita', 'Map'],
    ['.controls-content .mouse-keyboard tr:nth-child(7) td:last-child', 'Sessiz', 'Mute'],
    ['.controls-content .mouse-keyboard tr:nth-child(8) td:last-child', 'Fısıltı bırak', 'Leave a whisper'],
    ['.controls-content .mouse-keyboard tr:nth-child(9) td:last-child', 'Başa dön', 'Respawn'],
    ['.controls-content .mouse-keyboard tr:nth-child(10) td:last-child', 'Hidroliği çalıştır', 'Hydraulics'],
    ['.controls-content .mouse-keyboard tr:nth-child(11) td:last-child', 'Kamerayı oynat', 'Move camera'],
    ['.controls-content .mouse-keyboard tr:nth-child(12) td:last-child', 'Korna', 'Honk'],
    ['.achievements-content .title', 'Başarımlar', 'Achievements'],
    ['.achievements-content .rewards-container .title', 'Ödüller', 'Rewards'],
    ['.achievements-content .js-button-reset', 'Başarımları sıfırla', 'Reset achievements'],
    ['.circuit-content .title', 'Pist', 'Circuit'],
    ['.circuit-content .no-score', 'Bugün henüz skor yok', 'No scores yet today'],
    ['.whispers-content .title', 'Fısıltı bırak', 'Leave a whisper'],
    ['.whispers-content > .content-inner > p.text:first-of-type', 'Fısıltılar, ziyaretçilerin bıraktığı mesajlardır.', 'Whispers are short messages left by visitors.'],
    ['.behindTheScene-content .title', 'Perde arkası', 'Behind the scenes'],
    ['.behindTheScene-content p.text:first-of-type', 'Ziyaret ettiğin için teşekkürler! Bu dünyanın nasıl yapıldığını merak ediyorsan kısaca anlatayım.', 'Thanks for visiting! Here is a quick look at how this world was built.'],
    ['.behindTheScene-content h2:nth-of-type(1)', 'Kullanılan teknolojiler', 'Technologies used'],
    ['.behindTheScene-content h2:nth-of-type(2)', 'Klasik site', 'Classic site'],
    ['.modal.discord .title', 'İletişim', 'Contact'],
    ['.modal.discord .item:nth-child(1) .title', 'E-posta', 'Email'],
    ['.modal.discord .item:nth-child(1) p', 'Bir şey sormak ya da birlikte bir şey yapmak istersen yaz.', 'Write to me if you have a question or want to build something together.'],
    ['.modal.discord .item:nth-child(1) .button', 'E-posta gönder', 'Send email'],
    ['.modal.discord .item:nth-child(2) p', 'Kodlarım ve denemelerim burada.', 'My code and experiments live here.'],
    ['.modal.discord .item:nth-child(2) .button', "GitHub'a git", 'Go to GitHub'],
    ['.modal.circuit-end .not-top-10', "Üzgünüm, ilk 10'a giremedin.", "Sorry, you didn't make the top 10."],
    ['.modal.circuit-end .or', 'veya', 'or'],
    ['.modal.circuit-end .submit', 'Gönder', 'Submit'],
    ['.touch-buttons .interact', 'Etkileşim', 'Interact'],
    ['.touch-buttons .unstuck', 'Kurtar', 'Unstuck'],
    ['.js-page-external', 'Tam sayfa ↗', 'Full page ↗'],
    ['.js-map-hint', 'Işınlanmak için haritada bir alana tıkla', 'Click any area on the map to teleport there'],
]

export function getWorldLang()
{
    try
    {
        const param = new URLSearchParams(window.location.search).get('lang')
        if(param === 'en' || param === 'tr')
        {
            localStorage.setItem(LANG_KEY, param)
            return param
        }
        if(localStorage.getItem(LANG_KEY) === 'en')
            return 'en'
    }
    catch {}
    return 'tr'
}

export function applyWorldLang(lang)
{
    const next = lang === 'en' ? 'en' : 'tr'
    document.documentElement.lang = next
    try { localStorage.setItem(LANG_KEY, next) } catch {}

    const nav = document.querySelector('.classic-links')
    if(nav)
    {
        const links = nav.querySelectorAll('a[data-quick-index]')
        const entries = QUICK_NAV[next]
        links.forEach((a, i) =>
        {
            if(!entries[i]) return
            a.setAttribute('href', entries[i].href)
            a.dataset.pageTitle = entries[i].label
            a.textContent = entries[i].label
        })
        const langBtn = nav.querySelector('.js-lang-toggle')
        if(langBtn)
        {
            langBtn.textContent = next === 'en' ? 'TR' : 'EN'
            langBtn.title = next === 'en' ? 'Türkçeye geç' : 'Switch to English'
        }
    }

    for(const [selector, trText, enText] of TEXT_MAP)
    {
        const el = document.querySelector(selector)
        if(el) el.textContent = next === 'en' ? enText : trText
    }

    const whisperInput = document.querySelector('.whispers-content .js-input')
    if(whisperInput) whisperInput.placeholder = next === 'en' ? 'Your message' : 'Mesajın'

    const respawnBtn = document.querySelector('.options-content .js-respawn')
    if(respawnBtn)
    {
        const tip = respawnBtn.querySelector('.tooltip')
        if(tip) tip.textContent = next === 'en' ? 'Teleports you to the nearest respawn point' : 'Seni en yakın başlangıç noktasına ışınlar'
        for(const node of respawnBtn.childNodes)
            if(node.nodeType === 3 && node.textContent.trim())
                node.textContent = next === 'en' ? 'Respawn' : 'Başa dön'
    }
    const resetBtn = document.querySelector('.options-content .js-reset')
    if(resetBtn)
    {
        const tip = resetBtn.querySelector('.tooltip')
        if(tip) tip.textContent = next === 'en' ? 'Resets all world objects' : 'Tüm nesneleri sıfırlar'
        for(const node of resetBtn.childNodes)
            if(node.nodeType === 3 && node.textContent.trim())
                node.textContent = next === 'en' ? 'Reset' : 'Sıfırla'
    }

    if(nav) nav.setAttribute('aria-label', next === 'en' ? 'Quick navigation' : 'Hızlı gezinme')
    const menuTrigger = document.querySelector('.js-menu-trigger')
    if(menuTrigger) menuTrigger.setAttribute('aria-label', next === 'en' ? 'Open menu' : 'Menüyü aç')
    const mapTrigger = document.querySelector('.js-map-trigger')
    if(mapTrigger) mapTrigger.setAttribute('aria-label', next === 'en' ? 'Open map' : 'Haritayı aç')

    window.dispatchEvent(new CustomEvent('world-lang-change', { detail: next }))
}

export function initWorldI18n()
{
    let lang = getWorldLang()
    applyWorldLang(lang)

    const langBtn = document.querySelector('.js-lang-toggle')
    if(langBtn)
    {
        langBtn.addEventListener('click', (event) =>
        {
            event.preventDefault()
            lang = lang === 'en' ? 'tr' : 'en'
            applyWorldLang(lang)
        })
    }
}
