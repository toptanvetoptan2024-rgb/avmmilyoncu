# istoctoptancim.com (Qukasoft) – özel kodlar

Bu klasör toptanvetoptan.com sitesinin parçası değildir; sadece istoctoptancim.com
için yazılan / saklanan kodları tutar. Cloudflare'e yüklenmez.

| Dosya | Ne işe yarar |
|---|---|
| `kdv-dahil.css` / `kdv-dahil.js` | **KULLANILAN KOD.** Vitrin kartlarına ve ürün detay sayfasına mavi "KDV Dahil" etiketi ekler. Panelde CSS ve JS kutularına yapıştırılır. |
| `whatsapp-mobil.css` / `whatsapp-mobil.js` | **KULLANILAN KOD.** Mobilde sayfanın altında sabit yeşil "Whatsapp Destek İçin Tıklayınız" çubuğu. JS içindeki `TELEFON` doldurulmalı. |
| `xml-kategori-worker.js` | **KULLANILAN KOD.** cmtithalat XML'indeki karışık kategorileri düzeltir; her ürüne tek doğru kategori yazar. Ayrı bir Cloudflare Worker olarak kurulur (aşağıda anlatıldı). |
| `tema-scripts.js` | Temanın kendi JS kodu (`theme/___discovery/assets/scripts.js`). Sadece başvuru için. |
| `tema-style.css` | Temanın kendi CSS kodu (`theme/___discovery/assets/style.css`). Sadece başvuru için. |

## Bilinen tema yapısı
- Ürün kartı: `.card-product` → fiyat `.price-group .prices .sale-price` → buton `.buttons .btn-cart`
- Sepete ekleme: `addCart(ÜRÜN_ID, 'card')` (adet parametresi yok)
- Sepete eklendi penceresi: `addCartSuccessEvent(...)` → `showAlert(...)` (SweetAlert)
- Ana renk: `#1c7ad2`

## Temada HAZIR olan (panelden açılabilecek) özellikler
Tema CSS'inde şu parçalar zaten tanımlı; panelde ilgili ayar açılırsa kod gerekmeyebilir:
- `.card-product .quantity` → vitrin kartında adet seçme kutusu ("Ürün Kartı - Adet Seçimi")
- `.price-group .prices .list-price` → üstü çizili liste (eski) fiyat
- `.card-product .sale-price-basket` → kartta "sepetteki fiyat" kutusu
- `.product-transfer-discount` → havale indirimi kutusu

## cmtithalat XML kategori düzeltici – kurulum
Sorun: cmtithalat XML'inde ürünün bütün kategorileri Kat2, Kat3, Kat4 diye yan yana yazılıyor.
Qukasoft bunu "ana > alt kategori" sanıyor, ürünler yanlış yere (çoğu "Tv Ürünleri" altına) düşüyor.
`xml-kategori-worker.js` her ürüne tek kategori yazar; fiyat, stok, resim ve açıklamaya dokunmaz.

Kurallar (sırayla):
1. Ürün adında "telefon tutucu", "tripod/tripot", "selfie" geçiyorsa → **Tablet ve Telefon Tutucular**
2. Ürün adında "araba", "araç", "oto", "torpido" geçiyorsa → **Oto Aksesuarları**
3. "Tv Ürünleri" yok sayılır; kalanlardan en özel olan seçilir
   (Telefon Tutucular → Bebek Güvenlik → Evcil Hayvan → Ayak Bakım → Spor → Askı → Oto → Ev Mutfak Banyo)
4. Başka kategorisi yoksa "Tv Ürünleri" olarak kalır.

Kurulum adımları:
1. Cloudflare panelinde **Workers & Pages → Oluştur → Worker** deyin, bir ad verin (ör. `istoc-xml`), **Deploy**.
2. **Kodu düzenle (Edit code)** deyin, içindekini silin, `xml-kategori-worker.js` dosyasının tamamını yapıştırın, **Deploy**.
3. Worker'ın **Ayarlar → Değişkenler ve Gizli Bilgiler** bölümüne `CMT_XML_URL` ekleyin;
   değeri cmtithalat'tan aldığınız XML adresi. Adreste anahtar/şifre varsa türünü **Gizli (Secret)** seçin.
4. Tarayıcıda Worker adresini açın (`https://istoc-xml.<hesabınız>.workers.dev/`) – düzeltilmiş XML görünmeli.
5. Qukasoft panelinde XML adresi olarak cmtithalat adresi yerine bu Worker adresini yazın.
   Qukasoft'ta daha önce yanlış açılmış kategoriler (ör. "Tv Ürünleri > Ev Mutfak Banyo Gereçleri") elle silinmeli/boşaltılmalı.
