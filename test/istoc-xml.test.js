import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { kategoriSec, xmlDuzelt } from '../istoctoptancim/xml-kategori-worker.js';

const urun = (ad, kats) => `<product>
<urun_adi>
<![CDATA[ ${ad} ]]>
</urun_adi>
<kategoriler>
${kats.map((k, i) => `<Kat${i + 2}>\n<![CDATA[ ${k} ]]>\n</Kat${i + 2}>`).join('\n')}
</kategoriler>
<kdvdahilfiyat>
<![CDATA[ 18.00 ]]>
</kdvdahilfiyat>
<adet>
<![CDATA[ 0 ]]>
</adet>
</product>`;

test('Tv Ürünleri yok sayılır, özel kategori seçilir', () => {
  assert.equal(kategoriSec('Uyku Göz Bandı', ['Tv Ürünleri', 'Ev Mutfak Banyo Gereçleri']), 'Ev Mutfak Banyo Gereçleri');
  assert.equal(kategoriSec('Kemer Askısı', ['Ev Mutfak Banyo Gereçleri', 'Askı Çeşitleri']), 'Askı Çeşitleri');
});

test('ürün adında telefon tutucu geçen ürün telefon tutuculara gider', () => {
  assert.equal(kategoriSec('Araba Klimasına Takılan Telefon Tutucu', ['Oto Aksesuarları', 'Tablet ve Telefon Tutucular']), 'Tablet ve Telefon Tutucular');
  assert.equal(kategoriSec('Su Geçirmez Telefon Tutucu Stand', ['Tv Ürünleri', 'Ev Mutfak Banyo Gereçleri']), 'Tablet ve Telefon Tutucular');
});

test('sadece Tv Ürünleri olan ya da kategorisiz ürün yedek kategoriye gider', () => {
  assert.equal(kategoriSec('Sahte Dom Kamera', ['Tv Ürünleri']), 'Tv Ürünleri');
  assert.equal(kategoriSec('Nano Silgi', []), 'Tv Ürünleri');
});

test('XML düzeltilir: tek kategori kalır, fiyat ve stok aynen kalır', () => {
  const xml = `<products>\n${urun('Işıklı Araba Küllüğü', ['Tv Ürünleri', 'Oto Aksesuarları'])}\n${urun('Topuk Silikonu', ['Tv Ürünleri', 'Ayak Bakım Ürünleri'])}\n</products>`;
  const out = xmlDuzelt(xml);
  assert.equal((out.match(/<product>/g) || []).length, 2);
  assert.ok(!out.includes('Kat3'));
  assert.ok(!out.includes('Tv Ürünleri'));
  assert.ok(out.includes('<Kat2><![CDATA[Oto Aksesuarları]]></Kat2>'));
  assert.ok(out.includes('<Kat2><![CDATA[Ayak Bakım Ürünleri]]></Kat2>'));
  assert.equal((out.match(/18\.00/g) || []).length, 2);
  assert.equal((out.match(/<adet>\n<!\[CDATA\[ 0 \]\]>/g) || []).length, 2);
});

test('Worker: kaynak adres yoksa hata verir, varsa düzeltilmiş XML döner', async () => {
  const yok = await worker.fetch(new Request('https://x/'), {});
  assert.equal(yok.status, 500);
  const eski = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<products>${urun('Mini Tripot', ['Tv Ürünleri'])}</products>`);
  try {
    const cevap = await worker.fetch(new Request('https://x/'), { CMT_XML_URL: 'https://ornek/xml' });
    assert.equal(cevap.status, 200);
    assert.ok((await cevap.text()).includes('Tablet ve Telefon Tutucular'));
  } finally {
    globalThis.fetch = eski;
  }
});
