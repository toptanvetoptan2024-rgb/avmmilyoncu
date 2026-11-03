# AVM Milyoncu

**avmmilyoncu.com** – Çok satan ürünleri tek sayfada satan, mobil uyumlu e-ticaret sitesi ve yönetim paneli.
Tamamen **Cloudflare** üzerinde çalışır (Workers + D1 veritabanı).

## Müşteri ne görür?

Tek sayfada 4 adım:
1. **Ürünlerinizi Seçin** – 3 ürün kartı: fotoğraf, ad, kısa açıklama, fiyat, eski fiyat ve indirim oranı, stok durumu, adet seçimi, Sepete Ekle.
2. **Sepetiniz** – adet artır/azalt, ürün sil, ara toplam ve genel toplam. Sepet sayfa yenilense de korunur.
3. **Adres Bilgilerinizi Girin** – ad, soyad, telefon, e-posta (isteğe bağlı), il, ilçe, mahalle, açık adres, posta kodu ve not (isteğe bağlı).
4. **Siparişi Tamamla** – ödeme yöntemi, sözleşme onayı, sipariş özeti penceresi, ardından sipariş numarası.

## Ürünleri değiştirme (kod yazmadan)

Tüm ürün bilgileri **`urunler.json`** dosyasındadır. GitHub'da dosyayı açıp kalem simgesine basarak düzenleyin:

| Alan | Anlamı |
|---|---|
| `kod` | Ürünün sabit kimliği. **Değiştirmeyin** (geçmiş ve siparişler buna bağlı). |
| `ad` | Ürün adı |
| `kisaAciklama` | Kartta görünen kısa açıklama |
| `fiyat` | Satış fiyatı (TL), örnek `1799` veya `1799.90` |
| `eskiFiyat` | Üstü çizili eski fiyat; istemiyorsanız `null` |
| `gorsel` | Fotoğraf yolu. Fotoğrafı `public/urunler/` klasörüne yükleyin, adını buraya yazın |
| `ozellikler` | Kartta görünen en fazla 3 kısa özellik, ör. `["Hızlı ısınma", "Suya dayanıklı"]`. Yalnızca ürünün gerçekten sahip olduğu özellikleri yazın; istemiyorsanız `[]` |
| `stok` | `stokta`, `sinirli`, `tukendi` veya `teyit` (stok sipariş sonrası teyit edilir) |
| `aktif` | `false` yapılırsa ürün sitede görünmez ama silinmez |

Sitede en fazla 3 aktif ürün görünür. Ürün maliyeti ve kargo maliyeti gizli olduğu için dosyada değil, yönetim panelinde girilir.

## Mağaza ayarları

**`magaza.json`** dosyası:
- `odeme.kapidaOdeme`: Kapıda ödeme. **Kargo firmanız onaylayana kadar `false`**; `false` iken site sipariş almaz. Onay gelince `true` yapın.
- `kargo.musteriKargoUcreti`: Müşteriden alınan kargo ücreti (TL). `0` = ücretsiz kargo.
- `iletisim`: Telefon, e-posta, WhatsApp (boşsa sitede gösterilmez).
- `kampanya`: Sayfanın üstündeki turuncu kampanya alanı. `baslik` ve `altMetin` değiştirilebilir; `aktif: false` alanı gizler,
  `sayac: false` sayacı gizler. Sayaç Türkiye saatiyle gün sonuna (23:59:59) kadar kalan süreyi gösterir. Rozetteki
  "%..'a varan indirim" oranı ürünlerdeki en yüksek gerçek indirimden otomatik hesaplanır.

Cloudflare'de ortam değişkeniyle de değiştirilebilir: `KAPIDA_ODEME` = `acik` / `kapali`.

**Kart ödemesi:** Gerçek sanal POS (iyzico, PayTR vb.) bağlanmadığı için kapalıdır ve sitede "Yakında" yazar.
Altyapı `src/payments.js` dosyasında hazırdır. Kart numarası ve CVV bu sitede hiçbir zaman alınmaz ve saklanmaz;
müşteri sağlayıcının 3D Secure ödeme sayfasına yönlendirilir.

## Siparişler nerede saklanır?

Siparişler **Cloudflare D1 veritabanında**, sunucu tarafında saklanır (tarayıcıda değil). Her sipariş tek kayıttır:
ürünler, adetler, sipariş anındaki fiyatlar, toplam ve teslimat bilgileri. Aynı sipariş düğmeye iki kez basılsa
da bir kez kaydedilir. Siparişler `/yonetim` panelinden görülür.

## Yönetim paneli (`/yonetim`)

Şifre **kodda yoktur**; Cloudflare'de gizli değer olarak tanımlanır:
**Workers ve Pages → avmmilyoncu → Ayarlar → Değişkenler ve Gizli Diziler → + Ekle** →
Tür: **Gizli (Secret)**, ad: `ADMIN_PASSWORD`, değer: şifreniz → **Dağıt**.
(Yapılar/Derleme bölümündeki "derleme değişkenleri" panele ulaşmaz.) Şifre tanımlanmadan panel tamamen kilitlidir.

Panelde: kâr/ROAS raporu, ürün yuvaları (3 kazanan + 3 potansiyel + 3 test), maliyet girişi, siparişler (durum, not,
Excel'e aktarma), günlük reklam harcaması.

Siparişler üç sekmededir: **Gerçek siparişler**, **Test siparişleri**, **Arşivlenmiş testler**. Sipariş numarası (veya bir
parçası) ya da telefonla arama, duruma ve ürüne göre filtreleme yapılabilir.

### Test siparişi nasıl verilir?

1. `avmmilyoncu.com/yonetim` adresinden şifrenizle giriş yapın (telefonda denemek için telefonun tarayıcısından da girin).
2. Siteyi açın, ürünleri sepete ekleyin, adresi doldurun.
3. Ödeme yönteminde **Test Siparişi**'ni seçin (yalnızca giriş yapmış yöneticiye görünür) ve **Siparişi Tamamla**'ya basın.
4. Sipariş numarası ekranda görünür; sipariş veritabanına kaydedilir ve panelde **Test siparişleri** sekmesinde
   sarı **TEST SİPARİŞİ** etiketiyle listelenir. Raporlara, kâr hesabına ve reklam piksellerine girmez.

Test siparişleri silinmez, **arşivlenir** (sipariş ayrıntısında "Arşivle" ya da Test sekmesinde "Tüm test siparişlerini
arşivle"). Arşivleme yalnızca giriş yapmış yöneticiye açıktır ve gerçek siparişlere uygulanamaz.

## Cloudflare kurulumu

- Proje türü: **Workers** (Pages değil), GitHub deposuna bağlı.
- Derleme komutu: boş. Dağıtım komutu: `npx wrangler deploy`. Kök dizin: `/`.
- Statik dosyalar `public/` klasöründen yayınlanır (`wrangler.toml` → `[assets]`).
- D1 veritabanı ilk yüklemede otomatik oluşturulur; tablolar ve sürüm geçişleri ilk istekte otomatik uygulanır.
- Cloudflare'de "Üretim dalı" olarak hangi dal seçiliyse, o dala gönderilen her değişiklik siteye otomatik yüklenir.

## Geliştirici notları

```bash
npm install
```

```bash
npm test
```

Bilgisayarda Cloudflare ortamıyla denemek için `.dev.vars.example` dosyasını `.dev.vars` adıyla kopyalayın:

```bash
npm run dev
```

```
urunler.json         Ürünler (kod yazmadan düzenlenir)
magaza.json          Ödeme, kargo, iletişim ayarları
wrangler.toml        Cloudflare ayarları
src/index.js         Uygulama girişi, güvenlik başlıkları
src/catalog.js       urunler.json / magaza.json okuma ve veritabanına işleme
src/db.js            Veritabanı tabloları ve sürüm geçişleri
src/orders.js        Sipariş doğrulama ve kayıt
src/payments.js      Ödeme yöntemleri ve sanal POS altyapısı
src/reports.js       Kâr / ROAS raporu
src/routes/          Mağaza (/ ve /api/siparis) ve yönetim (/yonetim) adresleri
src/views/           Sayfa şablonları
public/js/magaza.js  Sepet ve sipariş formu (tarayıcı)
public/css/style.css Tasarım
public/urunler/      Ürün fotoğrafları
test/                Otomatik testler
```
