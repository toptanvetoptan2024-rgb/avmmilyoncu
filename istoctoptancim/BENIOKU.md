# istoctoptancim.com (Qukasoft) – özel kodlar

Bu klasör toptanvetoptan.com sitesinin parçası değildir; sadece istoctoptancim.com
için yazılan / saklanan kodları tutar. Cloudflare'e yüklenmez.

| Dosya | Ne işe yarar |
|---|---|
| `kdv-dahil.css` / `kdv-dahil.js` | **KULLANILAN KOD.** Vitrin kartlarına ve ürün detay sayfasına mavi "KDV Dahil" etiketi ekler. Panelde CSS ve JS kutularına yapıştırılır. |
| `whatsapp-mobil.css` / `whatsapp-mobil.js` | **KULLANILAN KOD.** Mobilde sayfanın altında sabit yeşil "Whatsapp Destek İçin Tıklayınız" çubuğu. JS içindeki `TELEFON` doldurulmalı. |
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
