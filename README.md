# Onur Can Orhan — Kişisel Web Sitesi

**Canlı site:** https://onurcanorhan.pages.dev/

Akdeniz Üniversitesi Bilgisayar Programcılığı öğrencisi olarak kendimi, projelerimi ve yazılarımı tanıttığım kişisel web sitem. "Web Tasarımının Temelleri" dersi vize projesi olarak hazırlandı.

## Site nasıl çalışıyor?

Site iki parçadan oluşuyor:

- **3D dünya (ana sayfa):** Siteyi açınca tarayıcıda arabayla gezilen küçük bir 3D dünya karşılıyor. Projelerim, kariyer yolum, iletişim ve sosyal bağlantılarım dünyanın içindeki alanlarda duruyor; bir alana arabayla yaklaşınca ilgili içerik açılıyor. Sol alt köşedeki "Klasik site" ve "English" bağlantılarıyla istediğin an normal sayfalara geçebilirsin.
- **Klasik site:** Aynı içeriği sade sayfalarda okumak isteyenler için. Türkçe ve İngilizce, telefon ve tablete uyumlu, açık/koyu tema seçenekli.

## Sayfalar

| Sayfa | İçerik |
|---|---|
| Anasayfa | Kısa tanıtım, öne çıkan projeler, galeriden örnekler, son yazılar |
| Hakkımda | Vesikalık fotoğraf, özgeçmiş, ders programı, ilgi alanları ve yüzdeli yetenekler |
| Projeler | Kömür (masaüstü kedi asistanı), Multistream Viewer ve bu site |
| Blog | HTML5, CSS3 ile responsive tasarım ve yazılımda yapay zekâ üzerine üç yazı |
| Galeri | Kendi fotoğraflarım ve projelerimden ekran görüntüleri |
| İletişim | Adres, telefon ve iletişim formu (form e-posta uygulamanı açar, site bilgi saklamaz) |

## Kullanılan teknolojiler

- **Klasik site:** HTML5, CSS3, JavaScript
- **3D dünya:** Three.js (WebGPU/WebGL), Rapier fizik motoru, Howler.js, Vite
- **Barındırma:** Cloudflare Pages ve Pages Functions (worker), içerik için Cloudflare D1
- **Erişilebilirlik ve SEO:** her sayfada ayrı başlık ve açıklama, TR/EN eşleşmesi (hreflang), yapılandırılmış veri, site haritası, ekran okuyucu etiketleri, azaltılmış hareket desteği

## Gizlilik ve güvenlik

- Takip ya da reklam çerezi yok, analitik kullanılmıyor.
- İletişim formu sunucuya veri göndermez; mesaj ziyaretçinin kendi e-posta uygulamasında hazırlanır.
- Tüm yanıtlarda güvenlik başlıkları (HTTPS zorunluluğu, başka sitelere gömülme engeli vb.) bulunur.

## Klasör yapısı

```
/            Klasik sitenin sayfaları (TR) ve en/ (İngilizce)
assets/      Stil dosyaları, betikler ve görseller
world/       3D dünyanın kaynak kodu
_worker.js   Sayfaları ve dosyaları sunan Cloudflare worker
tests/       Worker testleri (node --test tests/admin.test.mjs)
```
