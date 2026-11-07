/*
 * istoctoptancim.com – cmtithalat XML kategori düzeltici (Cloudflare Worker)
 *
 * NE YAPAR?
 *   cmtithalat XML'inde bir ürünün bütün kategorileri Kat2, Kat3, Kat4 diye
 *   arka arkaya yazılıyor. Qukasoft bunları "ana > alt" kategori sanıyor ve
 *   ürünler yanlış yere (çoğu "Tv Ürünleri" altına) düşüyor.
 *
 *   Bu kod her ürüne TEK bir ana kategori yazar. Kategori; ürün adı, açıklaması
 *   ve tedarikçinin verdiği kategorilere bakılarak puanla seçilir.
 *   Emin olunamayan ürünler tahminle bir yere konmaz: "Kontrol Edilecek Ürünler"
 *   kategorisine yazılır ve ayrı kontrol listesinde gösterilir.
 *
 *   Ürün sayısı aynen kalır. Sadece <kategoriler> etiketi değişir; ürün kodu,
 *   fiyat, KDV, stok, görsel ve açıklama alanlarına dokunulmaz.
 *
 * ADRESLER (Worker kurulduktan sonra)
 *   /            → Qukasoft'a verilecek düzeltilmiş XML
 *   /rapor       → hangi kategoriye kaç ürün düştüğü + kontrol listesi
 *
 * KURULUM: BENIOKU.md içinde adım adım anlatıldı.
 *   Worker ayarlarına CMT_XML_URL = cmtithalat XML adresi eklenir
 *   (adreste anahtar/şifre varsa "Gizli" (Secret) olarak).
 */

export const KONTROL_KATEGORISI = 'Kontrol Edilecek Ürünler';

// "Tv Ürünleri" bir vitrin etiketi gibi kullanılıyor, ürünün ne olduğunu söylemiyor.
const YOK_SAYILAN = ['Tv Ürünleri'];

// Kesin kurallar: ürün ADINDA geçerse başka hiçbir şeye bakılmadan bu kategori seçilir.
export const KESIN_KURALLAR = [
  {
    desen: /telefon\s*(tutucu|stand|büyüteç)|telefon ve kumanda stand|torpido telefon|tablet\s*(tutucu|stand)|laptop\s*stand|tripod|tripot|selfie/,
    kategori: 'Tablet ve Telefon Tutucular',
  },
  { desen: / (çocuk kilidi|bebek|köşe koruma|kenar koruma)/, kategori: 'Bebek Güvenlik Ürünleri' },
  // "Masa/sandalye ayak koruyucu" bir mobilya ürünüdür, ayak bakım değil.
  { desen: / (masa|sandalye|mobilya|koltuk) (ve sandalye )?ayak|sandalye ayak/, kategori: 'Ev Mutfak Banyo Gereçleri' },
  { desen: / (araba|araç|oto |otomobil|torpido|motosiklet)/, kategori: 'Oto Aksesuarları' },
  { desen: / (parmak ayırıcı|pedikür|topuk|tabanlık)/, kategori: 'Ayak Bakım Ürünleri' },
];

// Anahtar kelimeler (küçük harf). Kelimenin BAŞI eşleşir: "askı" → "askısı", "askılık".
export const KELIMELER = {
  'Tablet ve Telefon Tutucular': ['telefon tutucu', 'tablet tutucu', 'telefon standı', 'tablet standı', 'laptop', 'tripod', 'tripot', 'selfie', 'telefon büyüteç'],
  'Oto Aksesuarları': ['araba', 'araç', 'oto ', 'otomobil', 'torpido', 'direksiyon', 'dikiz', 'koltuk arkası', 'emniyet kemeri', 'cam silecek', 'park', 'çakmak'],
  'Ayak Bakım Ürünleri': ['topuk', 'tabanlık', 'ayakkabı', 'ayak', 'nasır', 'parmak ayırıcı', 'bunyon', 'halluks', 'çorap'],
  'Evcil Hayvan Ürünleri': ['kedi', 'köpek', 'evcil', 'mama kabı', 'mama', 'tasma', 'akvaryum', 'kuş ', 'pati ', 'tüy toplama', 'hayvan tüyü'],
  'Bebek Güvenlik Ürünleri': ['bebek', 'çocuk kilidi', 'köşe koruyucu', 'priz kapağı', 'priz koruyucu', 'dolap kilidi', 'çekmece kilidi', 'kenar koruyucu', 'köşe koruma', 'kenar koruma'],
  'Spor Aletleri': ['spor', 'egzersiz', 'fitness', 'direnç', 'atlama ipi', 'yoga', 'dambıl', 'pilates', 'kas ', 'karın'],
  'Askı Çeşitleri': ['askı', 'kanca', 'askılık', 'elbise askısı'],
  'Ev Mutfak Banyo Gereçleri': ['mutfak', 'banyo', 'duş', 'lavabo', 'küvet', 'tencere', 'tava', 'bıçak', 'sebze', 'meyve', 'temizlik', 'sünger', 'çamaşır', 'ocak', 'musluk', 'mop', 'çöp', 'raf', 'düzenleyici', 'saklama', 'kesme', 'rende', 'diş macunu', 'diş fırçası', 'tuvalet', 'klozet', 'buzdolabı', 'dolap', 'baharat', 'yemek', 'bardak', 'tabak', 'kaşık', 'süzgeç', 'sabun', 'havlu', 'ev '],
};

// Bir üründe birden çok kategori eşit puan alırsa üstteki seçilir (özel olan üstte).
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

const ADLAR = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ccedil: 'ç', Ccedil: 'Ç', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü',
  deg: '°', times: 'x', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '-', mdash: '-',
};

function varliklariCoz(metin) {
  return metin.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tam, ad) => {
    if (ad[0] === '#') {
      const kod = ad[1] === 'x' || ad[1] === 'X' ? parseInt(ad.slice(2), 16) : parseInt(ad.slice(1), 10);
      return Number.isFinite(kod) ? String.fromCodePoint(kod) : tam;
    }
    return ADLAR[ad] !== undefined ? ADLAR[ad] : tam;
  });
}

function cdataIcerik(metin) {
  const m = metin.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (m ? m[1] : metin).trim();
}

/** Açıklamadaki kaçışlı HTML'i düz metne çevirir. */
export function duzMetin(metin) {
  let s = metin || '';
  for (let i = 0; i < 3; i++) s = varliklariCoz(s); // &amp;ccedil; gibi iç içe kaçışlar
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function kucuk(metin) {
  return ' ' + (metin || '').toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9°]+/g, ' ') + ' ';
}

function say(metin, kelimeler) {
  let n = 0;
  for (const k of kelimeler) if (metin.includes(' ' + k)) n++;
  return n;
}

/**
 * Tek ürün için kategori kararı verir.
 * Dönen: { kategori, kesin: true/false, sebep }
 */
export function kategoriBelirle(urunAdi, aciklama, tedarikciKategorileri) {
  const ad = kucuk(urunAdi);
  const acik = kucuk(aciklama);
  const tedarikci = (tedarikciKategorileri || []).filter((k) => k && !YOK_SAYILAN.includes(k));

  for (const kural of KESIN_KURALLAR) {
    if (kural.desen.test(ad)) return { kategori: kural.kategori, kesin: true, sebep: 'ürün adı' };
  }

  const puanlar = ONCELIK.map((kat) => {
    const adda = say(ad, KELIMELER[kat] || []);
    const acikta = Math.min(say(acik, KELIMELER[kat] || []), 2);
    const ted = tedarikci.includes(kat) ? 1 : 0;
    return { kat, adda, acikta, ted, puan: adda * 3 + acikta + ted * 2 };
  });
  const sirali = [...puanlar].sort((a, b) => b.puan - a.puan); // eşitlikte ONCELIK sırası korunur
  const [bir, iki] = sirali;

  // Kesin sayılma şartları:
  //  - ürün adında o kategorinin kelimesi var ve ikinci kategoriden açıkça önde, ya da
  //  - tedarikçi kategorisi + açıklama aynı şeyi söylüyor ve rakip yok, ya da
  //  - tedarikçi tek bir anlamlı kategori vermiş ve ad/açıklamada buna aykırı bir şey yok.
  const fark = bir.puan - (iki ? iki.puan : 0);
  if (bir.adda > 0 && fark >= 2) return { kategori: bir.kat, kesin: true, sebep: 'ürün adı' };
  // Ürün adı ve tedarikçi aynı kategoriyi söylüyor, adda başka kategori daha güçlü değil.
  const adEnGuclu = Math.max(...puanlar.map((p) => p.adda));
  const uyusan = puanlar.find((p) => p.adda > 0 && p.ted && p.adda === adEnGuclu);
  if (uyusan && puanlar.filter((p) => p.adda === adEnGuclu && p.ted).length === 1) {
    return { kategori: uyusan.kat, kesin: true, sebep: 'ürün adı + tedarikçi' };
  }
  if (bir.ted && bir.acikta > 0 && fark >= 2) return { kategori: bir.kat, kesin: true, sebep: 'tedarikçi + açıklama' };
  if (tedarikci.length === 1 && bir.kat === tedarikci[0] && fark >= 2) {
    return { kategori: bir.kat, kesin: true, sebep: 'tedarikçi (tek kategori)' };
  }

  const adaylar = sirali.filter((p) => p.puan > 0).slice(0, 3).map((p) => p.kat);
  return {
    kategori: KONTROL_KATEGORISI,
    kesin: false,
    sebep: adaylar.length ? `kararsız: ${adaylar.join(' / ')}` : 'bilgi yok',
    adaylar,
  };
}

function alan(blok, etiket) {
  const m = blok.match(new RegExp(`<${etiket}>([\\s\\S]*?)</${etiket}>`));
  return m ? cdataIcerik(m[1]) : '';
}

/** Ürün bloğunu okur (rapor ve düzeltme için). */
export function urunOku(blok) {
  const katEsle = blok.match(/<kategoriler>([\s\S]*?)<\/kategoriler>|<kategoriler\s*\/>/);
  const kategoriler = [];
  if (katEsle && katEsle[1]) {
    const re = /<Kat\d+>([\s\S]*?)<\/Kat\d+>/g;
    let m;
    while ((m = re.exec(katEsle[1]))) kategoriler.push(duzMetin(cdataIcerik(m[1])));
  }
  const ad = duzMetin(alan(blok, 'urun_adi'));
  const karar = kategoriBelirle(ad, duzMetin(alan(blok, 'aciklama')), kategoriler);
  return { kod: alan(blok, 'urun_kodu'), ad, eskiKategoriler: kategoriler, katEsle, ...karar };
}

/** Tek bir <product> bloğunun sadece kategorisini değiştirir. */
export function urunDuzelt(blok) {
  const u = urunOku(blok);
  const yeni = `<kategoriler><Kat2><![CDATA[${u.kategori}]]></Kat2></kategoriler>`;
  if (u.katEsle) return blok.replace(u.katEsle[0], () => yeni);
  return blok.replace(/(<\/urun_adi>)/, (t) => `${t}\n${yeni}`);
}

const URUN_RE = /<product>[\s\S]*?<\/product>/g;

/** Bütün XML'i düzeltir. Ürün dışındaki her şey ve ürün sayısı aynen kalır. */
export function xmlDuzelt(xml) {
  return xml.replace(URUN_RE, (blok) => urunDuzelt(blok));
}

/** Kategori sayıları ve kontrol listesi. */
export function rapor(xml) {
  const urunler = (xml.match(URUN_RE) || []).map(urunOku);
  const sayilar = {};
  for (const u of urunler) sayilar[u.kategori] = (sayilar[u.kategori] || 0) + 1;
  return {
    toplam: urunler.length,
    sayilar,
    kontrol: urunler.filter((u) => !u.kesin).map(({ kod, ad, eskiKategoriler, sebep }) => ({ kod, ad, eskiKategoriler, sebep })),
    urunler: urunler.map(({ kod, ad, kategori, kesin, sebep }) => ({ kod, ad, kategori, kesin, sebep })),
  };
}

function raporMetni(r) {
  const satirlar = [`Toplam ürün: ${r.toplam}`, '', 'Kategori dağılımı:'];
  for (const [k, n] of Object.entries(r.sayilar).sort((a, b) => b[1] - a[1])) satirlar.push(`  ${String(n).padStart(4)}  ${k}`);
  satirlar.push('', `Kontrol listesi (${r.kontrol.length} ürün – elle kategori seçilmeli):`);
  for (const u of r.kontrol) satirlar.push(`  ${u.kod}\t${u.ad}\t(tedarikçi: ${u.eskiKategoriler.join(', ') || '-'}; ${u.sebep})`);
  return satirlar.join('\n');
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
    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/rapor') {
      return new Response(raporMetni(rapor(xml)), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    return new Response(xmlDuzelt(xml), {
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' },
    });
  },
};
