/*
 * istoctoptancim.com – cmtithalat XML kategori düzeltici (Cloudflare Worker)
 *
 * NE YAPAR?
 *   cmtithalat XML'inde bir ürünün bütün kategorileri Kat2, Kat3, Kat4 diye
 *   arka arkaya yazılıyor. Qukasoft bunları "ana > alt" kategori sanıyor ve
 *   ürünler yanlış yere (çoğu "Tv Ürünleri" altına) düşüyor.
 *   Bu kod XML'i alır, her ürüne TEK ve doğru bir kategori yazar (Kat2),
 *   diğer her şeyi (fiyat, stok, resim, açıklama) olduğu gibi bırakır.
 *
 * NASIL KURULUR? (BENIOKU.md içinde adım adım anlatıldı)
 *   1. Cloudflare → Workers → yeni Worker oluştur, bu dosyanın tamamını yapıştır.
 *   2. Ayarlar → Değişkenler: CMT_XML_URL = cmtithalat'tan aldığınız XML adresi
 *      (adreste anahtar/şifre varsa "Gizli" (Secret) olarak ekleyin).
 *   3. Worker adresini (https://....workers.dev/) Qukasoft'a XML adresi olarak verin.
 */

// Hiçbir anlamlı kategorisi olmayan ürünlerde kullanılır.
// cmtithalat'ın kendi kategorisi olduğu için aynen bırakıldı.
export const YEDEK_KATEGORI = 'Tv Ürünleri';

// "Tv Ürünleri" gerçek bir kategori değil, bir vitrin etiketi gibi kullanılıyor.
// Başka kategorisi olan ürünlerde dikkate alınmaz.
const YOK_SAYILAN = ['Tv Ürünleri'];

// Ürün adına göre kesin kurallar (ilk eşleşen kazanır).
export const AD_KURALLARI = [
  { desen: /telefon\s*tutucu|tablet\s*tutucu|tripod|tripot|selfie/i, kategori: 'Tablet ve Telefon Tutucular' },
  { desen: /\baraba\b|\boto\b|torpido|araç/i, kategori: 'Oto Aksesuarları' },
];

// Bir üründe birden çok kategori varsa, listede ÜSTTE olan seçilir
// (daha özel kategoriler üstte, genel olanlar altta).
export const ONCELIK = [
  'Tablet ve Telefon Tutucular',
  'Bebek Güvenlik Ürünleri',
  'Evcil Hayvan Ürünleri',
  'Ayak Bakım Ürünleri',
  'Spor Aletleri',
  'Askı Çeşitleri',
  'Oto Aksesuarları',
  'Ev Mutfak Banyo Gereçleri',
];

function cdataIcerik(metin) {
  const m = metin.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (m ? m[1] : metin).trim();
}

function ozelKarakter(metin) {
  return metin
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** Ürün adı ve XML'deki kategori listesine bakarak tek kategori seçer. */
export function kategoriSec(urunAdi, kategoriler) {
  const ad = urunAdi || '';
  for (const kural of AD_KURALLARI) {
    if (kural.desen.test(ad)) return kural.kategori;
  }
  const anlamli = kategoriler.filter((k) => k && !YOK_SAYILAN.includes(k));
  for (const k of ONCELIK) {
    if (anlamli.includes(k)) return k;
  }
  // Öncelik listesinde olmayan yeni bir kategori gelirse onu kullan.
  if (anlamli.length) return anlamli[0];
  return YEDEK_KATEGORI;
}

/** Tek bir <product> bloğunun kategorisini düzeltir. */
export function urunDuzelt(blok) {
  const adEsle = blok.match(/<urun_adi>([\s\S]*?)<\/urun_adi>/);
  const urunAdi = adEsle ? ozelKarakter(cdataIcerik(adEsle[1])) : '';

  const katEsle = blok.match(/<kategoriler>([\s\S]*?)<\/kategoriler>|<kategoriler\s*\/>/);
  const kategoriler = [];
  if (katEsle && katEsle[1]) {
    const re = /<Kat\d+>([\s\S]*?)<\/Kat\d+>/g;
    let m;
    while ((m = re.exec(katEsle[1]))) kategoriler.push(ozelKarakter(cdataIcerik(m[1])));
  }

  const secilen = kategoriSec(urunAdi, kategoriler);
  const yeni = `<kategoriler><Kat2><![CDATA[${secilen}]]></Kat2></kategoriler>`;

  if (katEsle) return blok.replace(katEsle[0], yeni);
  // Hiç kategori etiketi yoksa ürün adından sonra ekle.
  return blok.replace(/(<\/urun_adi>)/, `$1\n${yeni}`);
}

/** Bütün XML metnini düzeltir. Ürün dışındaki her şey aynen kalır. */
export function xmlDuzelt(xml) {
  return xml.replace(/<product>[\s\S]*?<\/product>/g, (blok) => urunDuzelt(blok));
}

export default {
  async fetch(request, env) {
    const kaynak = env && env.CMT_XML_URL;
    if (!kaynak) {
      return new Response('CMT_XML_URL ayarlanmamış (Worker ayarlarından ekleyin).', { status: 500 });
    }
    const cevap = await fetch(kaynak, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!cevap.ok) {
      return new Response(`Tedarikçi XML alınamadı (durum ${cevap.status}).`, { status: 502 });
    }
    const xml = await cevap.text();
    return new Response(xmlDuzelt(xml), {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=600',
      },
    });
  },
};
