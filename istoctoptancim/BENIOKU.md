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

`xml-kategori-worker.js` ne yapar:
- XML'deki **bütün ürünleri** aynen geçirir (ürün silinmez, eklenmez).
- Her ürüne **tek bir ana kategori** yazar (`<Kat2>`). Kategori; ürün adı, açıklaması ve
  tedarikçinin verdiği kategorilere bakılarak seçilir. "Tv Ürünleri" etiketi dikkate alınmaz.
- Emin olunamayan ürünler tahminle bir yere konmaz → **"Kontrol Edilecek Ürünler"** kategorisine yazılır.
- Ürün kodu, fiyat, KDV, stok, görsel, açıklama alanlarına **dokunmaz** (sadece `<kategoriler>` değişir).

Adresler:
- `https://<worker adresi>/` → Qukasoft'a verilecek düzeltilmiş XML
- `https://<worker adresi>/rapor` → kategori başına ürün sayısı + kontrol listesi

Kurulum adımları:
1. Cloudflare panelinde **Workers & Pages → Oluştur → Worker** deyin, bir ad verin (ör. `istoc-xml`), **Deploy**.
2. **Kodu düzenle (Edit code)** deyin, içindekini silin, `xml-kategori-worker.js` dosyasının tamamını yapıştırın, **Deploy**.
3. Worker'ın **Ayarlar → Değişkenler ve Gizli Bilgiler** bölümüne `CMT_XML_URL` ekleyin, türünü **Gizli (Secret)** seçin.
   Değeri: XML Havuzu'ndaki dışa aktarma adresiniz (`https://app.xmlhavuzu.com/_export/...`).
   Bu adres bir erişim anahtarı içerir; bu yüzden depoya yazılmadı.
4. Tarayıcıda `https://istoc-xml.<hesabınız>.workers.dev/rapor` açın – sayılar ve kontrol listesi görünmeli.
5. Qukasoft panelinde XML adresi olarak eski adres yerine `https://istoc-xml.<hesabınız>.workers.dev/` yazın.
6. Qukasoft'ta "Kontrol Edilecek Ürünler" kategorisini **pasif/gizli** yapın; o ürünlerin kategorisini elle seçin.
   Daha önce yanlış açılmış kategoriler (ör. "Tv Ürünleri > Ev Mutfak Banyo Gereçleri") boşaltılıp kaldırılmalı.

Kurallar `xml-kategori-worker.js` dosyasının başında: `KESIN_KURALLAR` (ürün adında geçerse kesin),
`KELIMELER` (kategori anahtar kelimeleri), `ONCELIK` (eşitlikte hangisi seçilir).
