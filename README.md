# Onur Can Orhan — Portfolyo

Canlı site: https://onurcanorhan.pages.dev/

Türkçe ve İngilizce çok sayfalı statik portfolyo. Kömür proje sayfası, GitHub kaynakları ve Windows 2.1 indirme bağlantıları içerir.

## Yerel önizleme

python -m http.server 8000

Ardından http://localhost:8000/ adresini açın.

## Yayın

Cloudflare Pages üzerinde onurcanorhan projesine kök klasör içeriği yayımlanır; derleme adımı gerekmez. _worker.js canlı sayfaları ve parola korumalı yönetimi sunar. Production ortamında DB bağlaması mevcut onur-portfolio-db D1 veritabanını göstermelidir. Site EXE barındırmaz: indirmeler sushikiddo/komur GitHub Releases üzerinden sunulur.

## Canlı yönetim

Panel: https://onurcanorhan.pages.dev/admin/

Mevcut parola korunur. Kömür başlık/açıklamaları Projeler bölümündedir. Kaydet canlı D1 içeriğine uygulanır. Eski sayfalar ilk kayıtta legacyPagesBefore20261117 alanında korunur; sorgular veri yazmaz. İlk içerik geçişi revision kontrolüyle gerçekleşir.

Testler: node --test tests/admin.test.mjs

## Kaynak ve lisans

HTML5 UP Phantom şablonu ve atıfları kaynak.txt ve LICENSE-Phantom.txt dosyalarındadır. Diğer lisans notları LICENSE-NOTE.txt içinde bulunur.
