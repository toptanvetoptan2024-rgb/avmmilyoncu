# AVM Milyoncu

**avmmilyoncu.com** – Popüler ürünleri reklamlarla tanıtıp satmak için hazırlanmış satış sitesi ve yönetim paneli.

## Neler var?

**Müşterinin gördüğü site**
- Mobil öncelikli, hızlı ana sayfa ve ürün sayfaları (turuncu, beyaz, antrasit)
- Reklam trafiğine uygun ürün sayfası: büyük görsel, indirimli fiyat, özellikler, sipariş formu, sık sorulan sorular, ekranın altında sabit "Sipariş Ver" butonu
- Kapıda ödeme; kartla ödeme şimdilik yalnızca **test (simülasyon)**
- İletişim, iade, mesafeli satış sözleşmesi ve KVKK sayfaları (taslak metin)

**Yönetim paneli** (`/yonetim`)
- **Panel:** ürün bazında ziyaret, reklam harcaması, sipariş, dönüşüm, ciro, ROAS ve **net kâr**; her ürün için öneri ("bütçeyi artır", "değiştirmeyi düşün" vb.)
- **Ürün yuvaları:** 3 kazanan + 3 potansiyel + 3 test (en fazla 9 aktif ürün)
- **Ürünler:** fiyat, maliyet, kargo, görsel ve metinleri formdan değiştirme; her fiyat/aşama değişikliği geçmişe kaydedilir
- **Siparişler:** durum takibi, not ekleme, Excel'e (CSV) aktarma; hangi reklamdan geldiği (UTM) görünür
- **Reklam:** günlük reklam harcamasını ürün ve kanal bazında girme

**Koruma kuralları**
- Ürünler silinmez, **pasif** yapılır. Pasif ürünün sayfası açılmaya devam eder, eski reklam linkleri bozulmaz.
- Siparişler silinmez, **iptal** durumuna alınır.
- Yanlış reklam kaydı silinmez, **geçersiz** sayılır.
- Sipariş anındaki fiyat ve maliyet siparişe kopyalanır; sonradan fiyat değişse de eski kâr hesapları doğru kalır.
- Test siparişleri raporlara girmez.

## Kâr nasıl hesaplanır?

```
Net kâr = Ciro − Ürün maliyeti − Kargo − Reklam harcaması
ROAS    = Ciro ÷ Reklam harcaması
```

İptal ve iade edilen siparişler ciroya girmez. İade edilen siparişin kargo maliyeti zarar olarak düşülür.

## Reklam linkleri

Reklamlarda ürün linkinin sonuna UTM ekleyin, siparişin hangi reklamdan geldiği kaydedilir:

```
https://avmmilyoncu.com/urun/elektrikli-isitici?utm_source=meta&utm_campaign=isitici-video1
```

## Bilgisayarda çalıştırma (geliştirici için)

Node.js 18 veya üstü gerekir.

```bash
npm install
```

```bash
ADMIN_PASSWORD=demo npm start
```

Site: http://localhost:3000 – Yönetim: http://localhost:3000/yonetim (şifre: `demo`)

Testler:

```bash
npm test
```

## Önemli ayarlar

Tüm ayarlar `.env.example` dosyasında açıklamalarıyla yazılı. En önemlileri:

| Ayar | Ne işe yarar |
|---|---|
| `ADMIN_PASSWORD` | Yönetim paneli şifresi. **Mutlaka değiştirin.** |
| `SESSION_SECRET` | Rastgele uzun bir metin. |
| `PAYMENT_MODE` | `test` = kart ödemesi simülasyon. Gerçek ödeme sağlayıcısı bağlanana kadar `test` kalmalı. |
| `DB_PATH`, `UPLOAD_DIR` | Siparişlerin ve görsellerin kaydedildiği yer. Sunucuda **kalıcı disk** üzerinde olmalı. |

## Gerçek kart ödemesi (sonraki adım)

Kod, `src/payments.js` dosyasında gerçek ödeme için hazır bir yer bırakır. iyzico veya PayTR gibi bir sağlayıcı seçildiğinde:

1. Önce sağlayıcının **test (sandbox)** anahtarlarıyla, `PAYMENT_MODE=test` iken denenir.
2. Her şey doğru çalışınca `PAYMENT_MODE=live` yapılır.

## Klasörler

```
server.js            Uygulamayı başlatır
src/db.js            Veritabanı tabloları ve ilk 3 ürün
src/products.js      Ürün kuralları (3+3+3 yuva, değişiklik geçmişi)
src/orders.js        Sipariş oluşturma ve durumlar
src/reports.js       Kâr / ROAS raporu
src/payments.js      Ödeme katmanı (test modu)
src/routes/          Site ve yönetim paneli sayfaları
views/               Sayfa şablonları
public/              Tasarım (CSS) ve görseller
test/                Otomatik testler
```
