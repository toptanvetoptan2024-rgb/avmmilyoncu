import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { kategoriBelirle, xmlDuzelt, rapor, KONTROL_KATEGORISI } from '../istoctoptancim/xml-kategori-worker.js';

const urun = (kod, ad, kats, aciklama = '') => `<product>
<urun_adi>
<![CDATA[ ${ad} ]]>
</urun_adi>
<urun_kodu>
<![CDATA[ ${kod} ]]>
</urun_kodu>
<kategoriler>
${kats.map((k, i) => `<Kat${i + 2}>\n<![CDATA[ ${k} ]]>\n</Kat${i + 2}>`).join('\n')}
</kategoriler>
<aciklama>
<![CDATA[ ${aciklama} ]]>
</aciklama>
<fiyat>
<![CDATA[ 15.00 ]]>
</fiyat>
<kdvdahilfiyat>
<![CDATA[ 18.00 ]]>
</kdvdahilfiyat>
<kdv>
<![CDATA[ 20 ]]>
</kdv>
<adet>
<![CDATA[ 0 ]]>
</adet>
<_image_1>
<![CDATA[ https://cmtithalat.com/image/a b.jpg ]]>
</_image_1>
</product>`;

const kat = (ad, kats, acik = '') => kategoriBelirle(ad, acik, kats);

test('ürün adındaki kesin kurallar', () => {
  assert.equal(kat('Araba Klimasına Takılan Telefon Tutucu', ['Oto Aksesuarları']).kategori, 'Tablet ve Telefon Tutucular');
  assert.equal(kat('Çok Amaçlı Araba Yıkama Süngeri', ['Tv Ürünleri', 'Oto Aksesuarları']).kategori, 'Oto Aksesuarları');
  assert.equal(kat('Masa ve Sandalye Ayak Koruyucu Silikon', ['Ayak Bakım Ürünleri']).kategori, 'Ev Mutfak Banyo Gereçleri');
  assert.equal(kat('4 Adet Buzdolabı, Çekmece ve Dolap Kapağı Çocuk Kilidi', ['Ev Mutfak Banyo Gereçleri']).kategori, 'Bebek Güvenlik Ürünleri');
  assert.equal(kat('Topuk Silikonu Şeffaf Pembe', ['Ayak Bakım Ürünleri']).kategori, 'Ayak Bakım Ürünleri');
});

test('Tv Ürünleri etiketi yok sayılır', () => {
  const k = kat('Kedi Oyun Oltası 90 cm', ['Tv Ürünleri', 'Evcil Hayvan Ürünleri']);
  assert.equal(k.kategori, 'Evcil Hayvan Ürünleri');
  assert.equal(k.kesin, true);
});

test('emin olunamayan ürün tahmin edilmez, kontrol listesine gider', () => {
  const k1 = kat('Caydırıcı Sahte Dom Kamera', ['Tv Ürünleri']);
  assert.equal(k1.kategori, KONTROL_KATEGORISI);
  assert.equal(k1.kesin, false);
  const k2 = kat('Duş Başlık Tutucu ve Lif Askısı', ['Ev Mutfak Banyo Gereçleri', 'Askı Çeşitleri']);
  assert.equal(k2.kategori, KONTROL_KATEGORISI);
});

test('XML: ürün sayısı aynı, tek kategori, diğer alanlar birebir aynı', () => {
  const xml = `<products>\n${urun('A1', 'Işıklı Araba Küllüğü', ['Tv Ürünleri', 'Oto Aksesuarları'], '&lt;p&gt;Ara&amp;ccedil; i&amp;ccedil;in&lt;/p&gt;')}\n${urun('A2', 'Sahte Dom Kamera', ['Tv Ürünleri'])}\n</products>`;
  const out = xmlDuzelt(xml);
  const bloklar = out.match(/<product>[\s\S]*?<\/product>/g);
  assert.equal(bloklar.length, 2);
  for (const b of bloklar) assert.equal((b.match(/<Kat\d+>/g) || []).length, 1);
  assert.ok(out.includes('<Kat2><![CDATA[Oto Aksesuarları]]></Kat2>'));
  assert.ok(out.includes(`<Kat2><![CDATA[${KONTROL_KATEGORISI}]]></Kat2>`));
  const sil = (s) => s.replace(/<kategoriler>[\s\S]*?<\/kategoriler>/g, '');
  assert.equal(sil(out), sil(xml));
});

test('rapor: sayılar ve kontrol listesi', () => {
  const xml = `<products>${urun('A1', 'Kedi Tasması', ['Evcil Hayvan Ürünleri'])}${urun('A2', 'Kumbara Nar Şekilli', ['Tv Ürünleri'])}</products>`;
  const r = rapor(xml);
  assert.equal(r.toplam, 2);
  assert.equal(r.sayilar['Evcil Hayvan Ürünleri'], 1);
  assert.equal(r.kontrol.length, 1);
  assert.equal(r.kontrol[0].kod, 'A2');
});

test('Worker: XML ve /rapor adresleri', async () => {
  assert.equal((await worker.fetch(new Request('https://x/'), {})).status, 500);
  const eski = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<products>${urun('A1', 'Mini Tripot', ['Tv Ürünleri'])}</products>`);
  try {
    const env = { CMT_XML_URL: 'https://ornek/xml' };
    const x = await worker.fetch(new Request('https://x/'), env);
    assert.equal(x.status, 200);
    assert.ok((await x.text()).includes('Tablet ve Telefon Tutucular'));
    const r = await worker.fetch(new Request('https://x/rapor'), env);
    assert.ok((await r.text()).includes('Toplam ürün: 1'));
  } finally {
    globalThis.fetch = eski;
  }
});
