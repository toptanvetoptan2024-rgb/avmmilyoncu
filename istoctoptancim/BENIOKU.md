# istoctoptancim.com (Qukasoft) – özel kodlar

Bu klasör toptanvetoptan.com sitesinin parçası değildir; sadece istoctoptancim.com
için yazılan / saklanan kodları tutar. Cloudflare'e yüklenmez.

| Dosya | Ne işe yarar |
|---|---|
| `vitrin-ozel.css` | Vitrin adet kutusu, mavi "KDV Dahil" etiketi, sepetteki indirimli fiyat görünümü. Qukasoft panelinde **CSS** kutusuna yapıştırılır. |
| `vitrin-ozel.js` | Aynı özelliklerin çalışan kodu. Qukasoft panelinde **JS** kutusuna yapıştırılır. |
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

## Dikkat
- `vitrin-ozel.js` içindeki "sepetteki indirim" bölümü (ORAN = 15) sadece görüntüdür.
  Qukasoft panelinde aynı oranda sepet kampanyası tanımlı değilse bu bölüm kullanılmamalı.
