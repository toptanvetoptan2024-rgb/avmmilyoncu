# CLAUDE.md – AVM Milyoncu proje talimatları

## Dil kuralı (çok önemli)
- Kullanıcıyla yapılan **tüm açıklamalar, ilerleme mesajları, sorular ve son raporlar TÜRKÇE** yazılır.
- Kod içi yorumlar, commit mesajları ve PR açıklamaları da Türkçe yazılır.
- Kullanıcı teknik değildir: sade dil kullan, adımları tek tek ve sırasıyla yaz.

## Çalışma kuralları
- Ana dala (`main`) doğrudan gönderim yapma. Kendi çalışma dalında ilerle, değişiklikleri GitHub'a gönder.
- Çalışan kodu gereksiz yere silme. Gerçek ortamda test etmediğin bir işlemi başarılı diye bildirme.
- Gizli bilgileri (şifre, API anahtarı) koda veya depoya yazma; Cloudflare'de "Gizli" (Secret) ortam değişkeni kullan.
- Müşteri bilgilerini (ad, telefon, adres) depoya, herkese açık dosyalara veya günlük kayıtlarına yazma.
- Ürün, sipariş, sipariş kalemi ve reklam kayıtları **silinmez** (veritabanı tetikleyicileri engeller);
  ürünler pasif yapılır, siparişler iptal edilir, reklam kaydı geçersiz sayılır.
- Sahte müşteri yorumu, puan veya doğrulanmamış stok bilgisi üretme.
- Gerçek sanal POS bağlanmadan kart ödemesinin çalıştığını söyleme; kart numarası/CVV asla bu sitede alınmaz.

## Proje yapısı
- Cloudflare Workers + D1 veritabanı. Ayarlar: `wrangler.toml` (statik dosyalar `public/`).
- `urunler.json`: sitedeki ürünler (en fazla 3 gösterilir). `magaza.json`: ödeme, kargo, iletişim ayarları.
- `src/`: sunucu kodu (Hono). `src/db.js` veritabanı şeması ve sürüm geçişleri (yeni geçiş listenin SONUNA eklenir).
- `public/js/magaza.js`: sepet ve sipariş formu (tarayıcı). Sepet localStorage'da, adres bilgisi tarayıcıda saklanmaz.
- `/api/siparis`: sipariş kaydı (sunucu tarafı doğrulama, tekrar gönderim koruması). `/yonetim`: şifreli yönetim paneli.

## Komutlar
- Testler: `npm test`
- Yerel Cloudflare ortamı: `.dev.vars.example` → `.dev.vars` kopyala, sonra `npm run dev`
- Derleme kontrolü: `npx wrangler deploy --dry-run`
