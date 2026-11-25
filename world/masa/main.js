import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import './style.css'
import { COPY, MAP_BOUNDS, STATIONS, getLang, setLang, stationLabel, stationUrl } from './i18n.js'
import { WorldAPI } from './api.js'
import { KomurCat, clampToLDesk } from './scene/komurCat.js'
import { DeskScene } from './scene/deskBuilder.js'
import { CozyRoom } from './scene/roomBuilder.js'
import { LaserGame } from './scene/laserGame.js'

const THEME_KEY = 'portfolio-theme-v2'

let lang = getLang()
document.documentElement.lang = lang

// High-quality PBR Renderer + ACES Filmic Tone Mapping + Soft Shadows
const canvas = document.getElementById('desk-canvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.04

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x0f111c, 0.017)

// Studio IBL reflections on glass, aluminum, walnut, ceramic, and Kömür's wet eyes
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.44
pmrem.dispose()

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 90)
camera.position.set(0.4, 6.8, 10.6)
camera.lookAt(0.4, 0.7, -0.4)

// Calibrated Post-Processing: crisp subtle bloom (threshold 1.08 prevents ANY paper/notebook whiteout!)
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.20, // subtle cinema bloom strength
    0.42, // tight radius
    1.08  // HDR-only threshold!
)
composer.addPass(bloomPass)
composer.addPass(new OutputPass())

// World modules
const textureLoader = new THREE.TextureLoader()
const room = new CozyRoom(scene, textureLoader)
const desk = new DeskScene(scene, textureLoader)
const cat = new KomurCat(scene)
const api = new WorldAPI()

// Camera & Interaction State
let activeModal = null
let nearestStation = null
let pendingOpenStation = null
let camMode = 'wide' // 'wide' | 'close'
let camYawOffset = 0
let camPitchOffset = 0
let camZoom = 0
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragMoved = false

const keys = new Set()
const touchDir = { up: false, down: false, left: false, right: false }

// UI Elements
const introOverlay = document.getElementById('intro-overlay')
const labelsRoot = document.getElementById('station-labels')
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const lampBadge = document.getElementById('lamp-badge')
const toastEl = document.getElementById('toast')
const pageModal = document.getElementById('page-modal')
const pageFrame = document.getElementById('page-modal-frame')
const pageTitle = document.getElementById('page-modal-title')
const pageExternal = document.getElementById('link-page-external')
const btnPageTheme = document.getElementById('btn-page-theme')
const btnCam = document.getElementById('btn-cam')
const touchInteractBtn = document.getElementById('btn-touch-interact')
const laserHud = document.getElementById('laser-hud')
const laserScoreEl = document.getElementById('laser-score')
const laserTimeEl = document.getElementById('laser-time')

let toastTimer = null
function showToast(msg)
{
    toastEl.textContent = msg
    toastEl.classList.add('is-show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2400)
}

function getTheme()
{
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}
function applyIframeTheme(theme)
{
    btnPageTheme.textContent = theme === 'dark' ? '☀️' : '🌙'
    try
    {
        const doc = pageFrame.contentDocument
        if(!doc) return
        doc.documentElement.dataset.theme = theme
        const btn = doc.querySelector('[data-theme-toggle]')
        if(btn) btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false')
    }
    catch {}
}

function openPageModal(url, title)
{
    cat.savePosition()
    activeModal = 'page'
    pageTitle.textContent = title
    pageExternal.href = url
    pageFrame.src = url
    pageModal.hidden = false
    applyIframeTheme(getTheme())
}

function closeAllModals()
{
    activeModal = null
    pageModal.hidden = true
    pageFrame.src = 'about:blank'
    document.getElementById('note-modal').hidden = true
    document.getElementById('laser-modal').hidden = true
    document.getElementById('map-modal').hidden = true
}

function openStation(station)
{
    if(!station) return
    openPageModal(stationUrl(station, lang), stationLabel(station, lang))
}

const laserGame = new LaserGame(
    scene,
    (g) =>
    {
        laserHud.hidden = !g.active
        laserScoreEl.textContent = String(g.score)
        laserTimeEl.textContent = String(Math.ceil(g.timeLeft))
    },
    (finalScore) =>
    {
        document.getElementById('laser-final-score').textContent = String(finalScore)
        renderLeaderboard()
        activeModal = 'laser'
        document.getElementById('laser-modal').hidden = false
    }
)

// 3D-projected HTML Labels
const labelNodes = new Map()
for(const s of STATIONS)
{
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'station-pill'
    btn.innerHTML = `<span class="dot" style="background:${s.accent}"></span><span class="lbl"></span><span class="key">E</span>`
    btn.addEventListener('click', (e) =>
    {
        e.stopPropagation()
        cat.setTarget(s.pos[0], s.pos[2])
        pendingOpenStation = s
    })
    labelsRoot.appendChild(btn)
    labelNodes.set(s.id, { el: btn, vec: new THREE.Vector3(...s.labelPos) })
}

// Expanded L-Desk Map Modal pins + live Kömür paw dot
const mapBoard = document.getElementById('desk-map-board')
const mapCatMarker = document.createElement('div')
mapCatMarker.className = 'map-pin'
mapCatMarker.style.pointerEvents = 'none'
mapCatMarker.style.background = '#dfe644'
mapCatMarker.style.color = '#12161f'
mapCatMarker.textContent = '🐾'
mapBoard.appendChild(mapCatMarker)

function worldToMapPct(x, z)
{
    const px = ((x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX)) * 100
    const py = ((z - MAP_BOUNDS.minZ) / (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ)) * 100
    return {
        x: THREE.MathUtils.clamp(px, 7, 93),
        y: THREE.MathUtils.clamp(py, 9, 91),
    }
}

const mapPins = new Map()
for(const s of STATIONS)
{
    const pin = document.createElement('button')
    pin.type = 'button'
    pin.className = 'map-pin'
    const mp = worldToMapPct(s.pos[0], s.pos[2])
    pin.style.left = `${mp.x}%`
    pin.style.top = `${mp.y}%`
    pin.style.borderColor = s.accent
    pin.addEventListener('click', (e) =>
    {
        e.stopPropagation()
        cat.teleport(s.pos[0], s.pos[2])
        closeAllModals()
    })
    mapBoard.appendChild(pin)
    mapPins.set(s.id, pin)
}

mapBoard.addEventListener('click', (e) =>
{
    if(e.target.closest('.map-pin')) return
    const rect = mapBoard.getBoundingClientRect()
    const rx = (e.clientX - rect.left) / rect.width
    const rz = (e.clientY - rect.top) / rect.height
    const wx = MAP_BOUNDS.minX + rx * (MAP_BOUNDS.maxX - MAP_BOUNDS.minX)
    const wz = MAP_BOUNDS.minZ + rz * (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ)
    const clamped = clampToLDesk(wx, wz)
    cat.teleport(clamped.x, clamped.z)
    closeAllModals()
})

function updateMapCatMarker()
{
    const mp = worldToMapPct(cat.position.x, cat.position.z)
    mapCatMarker.style.left = `${mp.x}%`
    mapCatMarker.style.top = `${mp.y}%`
}

function renderNotes()
{
    const ul = document.getElementById('note-list')
    ul.innerHTML = ''
    if(!api.whispers.length)
    {
        const li = document.createElement('li')
        li.textContent = COPY[lang].noteEmpty
        ul.appendChild(li)
        return
    }
    for(const w of api.whispers.slice(0, 10))
    {
        const li = document.createElement('li')
        li.textContent = w.message
        ul.appendChild(li)
    }
}

function renderLeaderboard()
{
    const ol = document.getElementById('laser-leaderboard')
    ol.innerHTML = ''
    if(!api.leaderboard.length)
    {
        const li = document.createElement('li')
        li.textContent = COPY[lang].laserNoScores
        ol.appendChild(li)
        return
    }
    api.leaderboard.slice(0, 10).forEach((entry, idx) =>
    {
        const [tag, , duration] = entry
        const li = document.createElement('li')
        li.innerHTML = `<span>#${idx + 1} · ${tag}</span><strong>${WorldAPI.decodeScore(duration)}</strong>`
        ol.appendChild(li)
    })
}

function applyLang(next)
{
    lang = setLang(next)
    const t = COPY[lang]
    document.title = t.title

    document.querySelectorAll('[data-i18n]').forEach((el) =>
    {
        const k = el.dataset.i18n
        if(t[k]) el.textContent = t[k]
    })

    document.getElementById('btn-lang').textContent = lang === 'en' ? 'TR' : 'EN'
    document.getElementById('link-intro-classic').href = lang === 'en' ? '/en/index.html' : '/anasayfa.html'
    document.getElementById('link-classic-nav').href = lang === 'en' ? '/en/index.html' : '/anasayfa.html'
    document.getElementById('note-input').placeholder = t.notePlaceholder
    document.getElementById('laser-tag-input').placeholder = t.laserTagPlaceholder

    for(const [id, key] of [
        ['btn-cam', 'camTitle'],
        ['btn-lamp', 'lampTitle'],
        ['btn-laser', 'laserTitle'],
        ['btn-note', 'noteTitle'],
        ['btn-map', 'mapTitle'],
        ['btn-reset', 'resetTitle'],
    ])
    {
        const btn = document.getElementById(id)
        btn.title = t[key]
        btn.setAttribute('aria-label', t[key])
    }

    document.querySelectorAll('.quick-nav a[data-station]').forEach((a) =>
    {
        const st = STATIONS.find((s) => s.id === a.dataset.station)
        if(!st) return
        a.href = stationUrl(st, lang)
        a.textContent = stationLabel(st, lang)
    })

    for(const s of STATIONS)
    {
        const lbl = stationLabel(s, lang)
        labelNodes.get(s.id).el.querySelector('.lbl').textContent = lbl
        mapPins.get(s.id).textContent = lbl
    }

    statusText.textContent = api.online ? t.online : t.offline
    lampBadge.textContent = t.lampModes[desk.lampMode]
    desk.setProjects(api.projects, lang)
    renderNotes()
    renderLeaderboard()
}

api.onUpdate(() =>
{
    statusDot.classList.toggle('is-online', api.online)
    statusText.textContent = api.online ? COPY[lang].online : COPY[lang].offline
    desk.setProjects(api.projects, lang)
    desk.setWhispers(api.whispers)
    renderNotes()
    renderLeaderboard()
})
api.init()

document.getElementById('btn-start').addEventListener('click', () =>
{
    introOverlay.classList.add('is-hidden')
    cat.meow()
})

document.getElementById('btn-lang').addEventListener('click', () => applyLang(lang === 'en' ? 'tr' : 'en'))

function toggleCameraMode()
{
    camMode = camMode === 'wide' ? 'close' : 'wide'
    btnCam.classList.toggle('is-active', camMode === 'close')
    camZoom = 0
    showToast(camMode === 'close' ? COPY[lang].toastCamClose : COPY[lang].toastCamWide)
}
btnCam.addEventListener('click', toggleCameraMode)

document.getElementById('btn-lamp').addEventListener('click', () =>
{
    const mode = desk.cycleLampMode()
    lampBadge.textContent = COPY[lang].lampModes[mode]
    document.getElementById('btn-lamp').textContent = mode === 'night' ? '🌙' : mode === 'day' ? '☀️' : '🌇'
    scene.fog.color.copy(scene.background)
    bloomPass.strength = mode === 'night' ? 0.28 : mode === 'day' ? 0.12 : 0.20
})

document.getElementById('btn-laser').addEventListener('click', () =>
{
    introOverlay.classList.add('is-hidden')
    closeAllModals()
    laserGame.start()
    showToast(COPY[lang].laserStart)
})

document.getElementById('btn-laser-stop').addEventListener('click', () => laserGame.stop(false))
document.getElementById('btn-laser-again').addEventListener('click', () => { closeAllModals(); laserGame.start() })

document.getElementById('btn-note').addEventListener('click', () =>
{
    renderNotes()
    activeModal = 'note'
    document.getElementById('note-modal').hidden = false
})

document.getElementById('btn-map').addEventListener('click', () =>
{
    updateMapCatMarker()
    activeModal = 'map'
    document.getElementById('map-modal').hidden = false
})

document.getElementById('btn-reset').addEventListener('click', () =>
{
    laserGame.stop(true)
    cat.reset()
    desk.resetProps()
    camYawOffset = 0
    camPitchOffset = 0
    camZoom = 0
    showToast(COPY[lang].toastReset)
})

document.querySelectorAll('.quick-nav a[data-station]').forEach((a) =>
{
    a.addEventListener('click', (e) =>
    {
        if(e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        openStation(STATIONS.find((s) => s.id === a.dataset.station))
    })
})

document.getElementById('btn-page-close').addEventListener('click', closeAllModals)
pageModal.addEventListener('click', (e) => { if(e.target === pageModal) closeAllModals() })
pageFrame.addEventListener('load', () => applyIframeTheme(getTheme()))
btnPageTheme.addEventListener('click', () =>
{
    const next = getTheme() === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    applyIframeTheme(next)
})

document.querySelectorAll('[data-close-modal]').forEach((btn) => btn.addEventListener('click', closeAllModals))
for(const id of ['note-modal', 'laser-modal', 'map-modal'])
{
    const el = document.getElementById(id)
    el.addEventListener('click', (e) => { if(e.target === el) closeAllModals() })
}

document.getElementById('note-form').addEventListener('submit', async (e) =>
{
    e.preventDefault()
    const input = document.getElementById('note-input')
    const msg = input.value.trim()
    if(!msg) return
    const res = await api.postWhisper(msg, lang)
    input.value = ''
    showToast(res.offline ? COPY[lang].toastNoteOffline : COPY[lang].toastNoteSaved)
})

document.getElementById('laser-score-form').addEventListener('submit', async (e) =>
{
    e.preventDefault()
    const tagInput = document.getElementById('laser-tag-input')
    await api.postLaserScore(tagInput.value, laserGame.score, lang)
    tagInput.value = ''
    showToast(COPY[lang].toastScoreSaved)
})

window.addEventListener('keydown', (e) =>
{
    if(e.key === 'Escape')
    {
        if(activeModal) closeAllModals()
        return
    }
    if(activeModal || !introOverlay.classList.contains('is-hidden'))
    {
        if(e.key === 'Enter' && !introOverlay.classList.contains('is-hidden'))
        {
            introOverlay.classList.add('is-hidden')
            cat.meow()
        }
        return
    }
    const k = e.key.toLowerCase()
    if(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k))
    {
        keys.add(k)
        if(k !== 'shift') pendingOpenStation = null
    }
    else if(e.code === 'Space')
    {
        e.preventDefault()
        cat.jump()
    }
    else if(k === 'e' || e.key === 'Enter')
    {
        if(nearestStation) openStation(nearestStation)
    }
    else if(k === 'c') toggleCameraMode()
    else if(k === 'l') document.getElementById('btn-lamp').click()
    else if(k === 'm') document.getElementById('btn-map').click()
    else if(k === 'f') { cat.pet(); showToast(COPY[lang].toastPet) }
})
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

document.querySelectorAll('.dpad-btn').forEach((btn) =>
{
    const dir = btn.dataset.dir
    const down = (e) => { e.preventDefault(); touchDir[dir] = true; pendingOpenStation = null }
    const up = (e) => { e.preventDefault(); touchDir[dir] = false }
    btn.addEventListener('pointerdown', down)
    btn.addEventListener('pointerup', up)
    btn.addEventListener('pointercancel', up)
    btn.addEventListener('pointerleave', up)
})
document.getElementById('btn-touch-jump').addEventListener('click', () => cat.jump())
touchInteractBtn.addEventListener('click', () => { if(nearestStation) openStation(nearestStation) })

// Drag Orbit (yaw + subtle pitch) + Scroll Zoom + Click-to-Go + Click Kömür to Pet!
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

canvas.addEventListener('wheel', (e) =>
{
    if(activeModal) return
    camZoom = THREE.MathUtils.clamp(camZoom + e.deltaY * 0.0045, -3.4, 3.8)
}, { passive: true })

canvas.addEventListener('pointerdown', (e) =>
{
    isDragging = true
    dragMoved = false
    dragStartX = e.clientX
    dragStartY = e.clientY
})

window.addEventListener('pointermove', (e) =>
{
    if(!isDragging) return
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    if(Math.hypot(dx, dy) > 6) dragMoved = true
    camYawOffset = THREE.MathUtils.clamp(camYawOffset - dx * 0.0036, -1.05, 1.05)
    camPitchOffset = THREE.MathUtils.clamp(camPitchOffset + dy * 0.004, -1.6, 2.2)
    dragStartX = e.clientX
    dragStartY = e.clientY
})

window.addEventListener('pointerup', (e) =>
{
    if(!isDragging) return
    isDragging = false
    if(dragMoved || activeModal || !introOverlay.classList.contains('is-hidden')) return

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    // Click Kömür directly to pet!
    const catHits = raycaster.intersectObject(cat.group, true)
    if(catHits.length > 0)
    {
        cat.pet()
        showToast(COPY[lang].toastPet)
        return
    }

    const propHits = raycaster.intersectObjects(desk.clickTargets, true)
    if(propHits.length > 0)
    {
        const stationId = propHits[0].object.userData.stationId
        if(stationId === 'lamp')
        {
            document.getElementById('btn-lamp').click()
            return
        }
        const st = STATIONS.find((s) => s.id === stationId)
        if(st)
        {
            cat.setTarget(st.pos[0], st.pos[2])
            pendingOpenStation = st
            return
        }
    }

    const floorHits = raycaster.intersectObjects(desk.deskFloors, false)
    if(floorHits.length > 0)
    {
        pendingOpenStation = null
        cat.setTarget(floorHits[0].point.x, floorHits[0].point.z)
    }
})

window.addEventListener('resize', () =>
{
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    bloomPass.setSize(w, h)
})

applyLang(lang)

const clock = new THREE.Clock()
const projVec = new THREE.Vector3()
const desiredCamPos = new THREE.Vector3()
const lookTarget = new THREE.Vector3()

function animate()
{
    requestAnimationFrame(animate)
    const dt = Math.min(0.05, clock.getDelta())
    const elapsed = clock.elapsedTime
    const inIntro = !introOverlay.classList.contains('is-hidden')

    let ix = 0
    let iz = 0
    if(!activeModal && !inIntro)
    {
        if(keys.has('w') || keys.has('arrowup') || touchDir.up) iz -= 1
        if(keys.has('s') || keys.has('arrowdown') || touchDir.down) iz += 1
        if(keys.has('a') || keys.has('arrowleft') || touchDir.left) ix -= 1
        if(keys.has('d') || keys.has('arrowright') || touchDir.right) ix += 1
    }

    if(ix !== 0 || iz !== 0)
    {
        const c = Math.cos(camYawOffset)
        const s = Math.sin(camYawOffset)
        const rx = ix * c + iz * s
        const rz = -ix * s + iz * c
        ix = rx
        iz = rz
    }

    cat.update(dt, { x: ix, z: iz, sprint: keys.has('shift') }, elapsed, desk.pushables, desk.platforms, desk.obstacles)
    desk.update(dt, elapsed)
    room.update(dt, elapsed, desk.lampMode)
    laserGame.update(dt, cat, elapsed)

    let closest = null
    let bestDist = 1.95
    for(const s of STATIONS)
    {
        const d = Math.hypot(cat.position.x - s.pos[0], cat.position.z - s.pos[2])
        if(d < bestDist)
        {
            bestDist = d
            closest = s
        }
    }
    nearestStation = closest
    touchInteractBtn.hidden = !nearestStation

    if(pendingOpenStation && Math.hypot(cat.position.x - pendingOpenStation.pos[0], cat.position.z - pendingOpenStation.pos[2]) < 1.1)
    {
        const target = pendingOpenStation
        pendingOpenStation = null
        openStation(target)
    }

    // Smooth responsive camera supporting both Wide Studio and Close-Up Kömür modes
    const aspectBoost = camera.aspect < 1.35 ? (1.35 - camera.aspect) * 4.4 : 0
    const yaw = inIntro ? Math.sin(elapsed * 0.22) * 0.30 : camYawOffset
    const isClose = camMode === 'close' && !inIntro
    const baseRadius = inIntro ? 10.6 : (isClose ? 3.9 : 9.4)
    const baseHeight = inIntro ? 6.2 : (isClose ? 2.45 : 6.1)
    const followWeightX = isClose ? 0.92 : 0.56
    const followWeightZ = isClose ? 0.92 : 0.48
    const radius = Math.max(2.2, baseRadius + aspectBoost + camZoom)

    desiredCamPos.set(
        cat.position.x * followWeightX + Math.sin(yaw) * radius,
        Math.max(1.2, baseHeight + aspectBoost * 0.45 + camZoom * 0.35 + camPitchOffset),
        cat.position.z * followWeightZ + Math.cos(yaw) * radius
    )
    camera.position.lerp(desiredCamPos, Math.min(1, dt * 4.5))
    lookTarget.set(
        cat.position.x * (isClose ? 0.96 : 0.58),
        isClose ? (cat.position.y + 0.56) : 0.78,
        cat.position.z * (isClose ? 0.96 : 0.48) - (isClose ? 0 : 0.55)
    )
    camera.lookAt(lookTarget)

    // 3D projected labels clamped strictly inside safe screen margins (NEVER clipped off edge!)
    const w = window.innerWidth
    const h = window.innerHeight
    const hw = w * 0.5
    const hh = h * 0.5
    for(const s of STATIONS)
    {
        const node = labelNodes.get(s.id)
        projVec.copy(node.vec).project(camera)
        const inFront = projVec.z < 1 && projVec.x > -1.08 && projVec.x < 1.08 && projVec.y > -1.05 && projVec.y < 1.05
        const visible = inFront && !activeModal && !inIntro
        node.el.style.display = visible ? 'inline-flex' : 'none'
        if(visible)
        {
            const sx = THREE.MathUtils.clamp(projVec.x * hw + hw, 72, w - 72)
            const sy = THREE.MathUtils.clamp(-projVec.y * hh + hh, 74, h - 76)
            node.el.style.left = `${sx}px`
            node.el.style.top = `${sy}px`
            node.el.classList.toggle('is-near', nearestStation?.id === s.id)
        }
    }

    composer.render()
}

animate()
