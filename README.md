# AVM Milyoncu

**avmmilyoncu.com** – Popüler ürünleri reklamlarla tanıtıp satmak için hazırlanmış satış sitesi ve yönetim paneli.
Tamamen **Cloudflare** üzerinde çalışır (Workers + D1 veritabanı + KV görsel deposu).

## Neler var?

**Müşterinin gördüğü site**
- Mobil öncelikli, hızlı ana sayfa ve ürün sayfaları (turuncu, beyaz, antrasit)
- Reklam trafiğine uygun ürün sayfası: büyük görsel, indirimli fiyat, özellikler, sipariş formu, sık sorulan sorular, ekranın altında sabit "Sipariş Ver" butonu
- Kapıda ödeme; kartla ödeme şimdilik yalnızca **test (simülasyon)** – gerçek para çekilmez
- İletişim, iade, mesafeli satış sözleşmesi ve KVKK sayfaları (taslak metin)
- Başlangıç ürünleri (örnek fiyatlarla): Elektrikli Isıtıcı, Şemsiye, Masaj Aleti

**Yönetim paneli** (`/yonetim`)
- **Panel:** ürün bazında ziyaret, reklam harcaması, sipariş, dönüşüm, ciro, ROAS ve **net kâr**; her ürün için öneri
- **Ürün yuvaları:** 3 kazanan + 3 potansiyel + 3 test (en fazla 9 aktif ürün)
- **Ürünler:** fiyat, maliyet, kargo, fotoğraf ve metinleri formdan değiştirme; her değişiklik geçmişe kaydedilir
- **Siparişler:** durum takibi, not ekleme, Excel'e (CSV) aktarma; hangi reklamdan geldiği (UTM) görünür
- **Reklam:** günlük reklam harcamasını ürün ve kanal bazında girme

**Koruma kuralları**
- Ürünler silinmez, **pasif** yapılır. Pasif ürünün sayfası açılmaya devam eder, eski reklam linkleri bozulmaz.
- Siparişler silinmez, **iptal** durumuna alınır. Yanlış reklam kaydı **geçersiz** sayılır.
- Sipariş anındaki fiyat ve maliyet siparişe kopyalanır; sonradan fiyat değişse de eski kâr hesapları doğru kalır.
- Test siparişleri raporlara girmez.

## Cloudflare'de yayınlama

1. Cloudflare panelinde **Workers & Pages → Create (Oluştur)** → **Workers** sekmesi → **Import a repository (Depo içe aktar)**.
   *(Pages değil, Workers seçilmeli.)*
2. GitHub'dan **avmmilyoncu** deposunu seçin.
3. Ayarlar:
   - Proje adı: `avmmilyoncu`
   - Build command (Derleme komutu): boş bırakın
   - Deploy command (Yükleme komutu): `npx wrangler deploy`
4. **Deploy** düğmesine basın. Veritabanı (D1) ve görsel deposu (KV) ilk yüklemede **otomatik oluşturulur**.
5. Yükleme bitince Worker'ın **Settings → Variables and Secrets** bölümüne gidin, **Add** ile:
   - Tür **Secret**, ad `ADMIN_PASSWORD`, değer: yönetim paneli şifreniz
   - (İsteğe bağlı, tür Text) `CONTACT_PHONE`, `CONTACT_EMAIL`, `CONTACT_WHATSAPP` (905xxxxxxxxx)
6. **Settings → Domains & Routes → Add → Custom domain** ile `avmmilyoncu.com` ekleyin.

Bundan sonra GitHub'a gönderilen her değişiklik siteye otomatik yüklenir.

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

## Gerçek kart ödemesi (sonraki adım)

`src/payments.js` dosyasında gerçek ödeme için hazır bir yer var. iyzico veya PayTR gibi bir sağlayıcı seçildiğinde
önce sağlayıcının **test (sandbox)** anahtarlarıyla denenir; her şey doğru çalışınca `wrangler.toml` içinde
`PAYMENT_MODE = "live"` yapılır. Canlı modda sağlayıcı bağlı değilse kart seçeneği sitede hiç görünmez.

## Geliştirici notları

```bash
npm install
```

Bilgisayarda Cloudflare ortamıyla çalıştırmak için `.dev.vars.example` dosyasını `.dev.vars` adıyla kopyalayın, sonra:

```bash
npm run dev
```

Testler:

```bash
npm test
```

```
wrangler.toml        Cloudflare ayarları (D1, KV, statik dosyalar)
src/index.js         Uygulamanın giriş noktası
src/db.js            Veritabanı tabloları (ilk istekte otomatik kurulur) ve ilk 3 ürün
src/products.js      Ürün kuralları (3+3+3 yuva, değişiklik geçmişi)
src/orders.js        Sipariş oluşturma ve durumlar
src/reports.js       Kâr / ROAS raporu
src/payments.js      Ödeme katmanı (test modu)
src/routes/          Site ve yönetim paneli adresleri
src/views/           Sayfa şablonları
public/              Tasarım (CSS) ve görseller
test/                Otomatik testler
```
