import './threejs-override.js'
import { Game } from './Game/Game.js'
import consoleLog from './data/consoleLog.js'

if(import.meta.env.VITE_LOG)
    console.log(
        ...consoleLog
    )

const showLoadError = (error) =>
{
    console.error('3D world failed to start', error)
    const element = document.querySelector('.js-load-error')
    if(!element)
        return
    element.hidden = false
    document.documentElement.classList.add('has-load-error')
    element.querySelector('.js-load-retry')?.addEventListener('click', () => location.reload())
}

if(!navigator.gpu && !document.createElement('canvas').getContext('webgl2'))
{
    showLoadError(new Error('WebGPU/WebGL not available'))
}
else
{
    try
    {
        const game = new Game()
        if(import.meta.env.VITE_GAME_PUBLIC)
            window.game = game
        game.initPromise?.catch(showLoadError)
    }
    catch(error)
    {
        showLoadError(error)
    }
}
