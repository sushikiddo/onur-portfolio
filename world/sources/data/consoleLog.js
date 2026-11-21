import * as THREE from 'three/webgpu'

const text = `
 ██████╗ ███╗   ██╗██╗   ██╗██████╗ 
██╔═══██╗████╗  ██║██║   ██║██╔══██╗
██║   ██║██╔██╗ ██║██║   ██║██████╔╝
██║   ██║██║╚██╗██║██║   ██║██╔══██╗
╚██████╔╝██║ ╚████║╚██████╔╝██║  ██║
 ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝

╔═ Giriş ═══════════════╗
║ Portfolyoma uğradığın için teşekkürler!
║ Merak ediyorsan, bu projenin nasıl yapıldığı aşağıda.
╚═══════════════════════╝

╔═ İletişim ══════════════╗
║ E-posta ⇒ onurcan147258@gmail.com
║ GitHub  ⇒ https://github.com/sushikiddo
╚═══════════════════════╝

╔═ Hata ayıklama ═══════╗
║ URL'nin sonuna #debug ekleyip sayfayı yenileyerek hata ayıklama moduna girebilirsin.
║ Serbest kamerayı açıp kapatmak için [V] tuşuna bas.
╚═══════════════════════╝

╔═ Three.js ════════════╗
║ Bu 3D dünyayı çizmek için Three.js kullanıyorum (sürüm: ${THREE.REVISION})
║ https://threejs.org/
╚═══════════════════════╝

╔═ Kaynak kod ══════════╗
║ Bu proje MIT lisansıyla açık kaynak bir 3D portfolyo çalışmasının üzerine kuruludur;
║ lisans metni depoda license.md dosyasında bulunur.
╚═══════════════════════╝

╔═ Bağlantılar ═════════╗
║ Rapier (Fizik kütüphanesi) ⇒ https://rapier.rs/
║ Howler.js (Ses kütüphanesi) ⇒ https://howlerjs.com/
║ Amatic SC (Yazı tipi)      ⇒ https://fonts.google.com/specimen/Amatic+SC
║ Nunito (Yazı tipi)         ⇒ https://fonts.google.com/specimen/Nunito
╚═══════════════════════╝
`
let finalText = ''
let finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null
for(let i = 0; i < text.length; i++)
{
    const char = text[i]

    const style = char.match(/[╔║═╗╚╝╔╝]/) ? 'pipe' : 'letter'
    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'

        finalStyles.push(stylesSet[currentStyle])
    }
    finalText += char
}

export default [finalText, ...finalStyles]