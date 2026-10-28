import test from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/index.js';
import { productReport } from '../src/reports.js';
import { parseTRY } from '../src/money.js';
import { todayTR } from '../src/time.js';
import { readCatalog, readStore } from '../src/catalog.js';
import { createD1 } from './d1-shim.js';

const DB = createD1();
const env = { DB, ADMIN_PASSWORD: 'test-sifre', KAPIDA_ODEME: 'acik' };
const app = createApp();
const sql = DB.raw;
const HOST = 'http://localhost';

const req = (path, init = {}, e = env) => app.request(HOST + path, { redirect: 'manual', ...init }, e);
const post = (path, body, headers = {}) => req(path, {
  method: 'POST',
  body: new URLSearchParams(body).toString(),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
});
let keyN = 0;
const newKey = () => `test-anahtar-${Date.now()}-${++keyN}`;
const order = (extra = {}, e = env, headers = {}) => req('/api/siparis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: HOST, ...headers },
  body: JSON.stringify({
    sepet: [{ kod: 'masaj-tabancasi', adet: 2 }, { kod: 'kablosuz-kulaklik', adet: 1 }],
    ad: 'Ayşe', soyad: 'Yılmaz', telefon: '0532 123 45 67', eposta: '', il: 'İstanbul', ilce: 'Kadıköy',
    mahalle: 'Caferağa', adres: 'Moda Cad. No: 5 D: 3', postaKodu: '', not: '', odemeYontemi: 'kapida', onay: true,
    anahtar: newKey(), ...extra,
  }),
}, e);
async function adminCookie() {
  const r = await post('/yonetim/giris', { password: 'test-sifre' });
  assert.strictEqual(r.status, 302);
  return r.headers.get('set-cookie').split(';')[0];
}
const countOrders = () => sql.prepare('SELECT COUNT(*) n FROM orders').get().n;

// ---------------- Katalog ve ayar dosyaları ----------------

test('urunler.json: 3 ürün okunur, fiyatlar kuruşa çevrilir', () => {
  const { products, problems } = readCatalog();
  assert.deepStrictEqual(problems, []);
  assert.deepStrictEqual(products.map((p) => p.slug), ['semsiye-tipi-isitici', 'masaj-tabancasi', 'kablosuz-kulaklik']);
  assert.strictEqual(products[0].price, 179900);
  assert.strictEqual(products[0].compare_price, 299900);
  assert.ok(products.every((p) => p.stock === 'teyit'), 'doğrulanmamış stok bilgisi üretilmemeli');
});

test('urunler.json: hatalı girişler atlanır ve sebebi bildirilir', () => {
  const { products, problems } = readCatalog({ urunler: [
    { kod: 'Büyük Harf', ad: 'X', fiyat: 10 },
    { kod: 'iyi', ad: 'İyi', fiyat: 10, eskiFiyat: 5 },
    { kod: 'iyi', ad: 'Tekrar', fiyat: 10 },
    { kod: 'fiyatsiz', ad: 'Fiyatsız' },
  ] });
  assert.strictEqual(products.length, 1);
  assert.strictEqual(products[0].compare_price, null, 'eski fiyat yeni fiyattan küçükse gösterilmez');
  assert.strictEqual(problems.length, 3);
});

test('magaza.json: kapıda ödeme varsayılan olarak kapalı, ortam değişkeniyle açılabilir', () => {
  assert.strictEqual(readStore({}).cashOnDelivery, false);
  assert.strictEqual(readStore({ KAPIDA_ODEME: 'acik' }).cashOnDelivery, true);
  assert.strictEqual(readStore({}).shippingFee, 0);
});

test('parseTRY Türkçe tutarları kuruşa çevirir', () => {
  assert.strictEqual(parseTRY('1.299,90'), 129990);
  assert.strictEqual(parseTRY('899'), 89900);
  assert.strictEqual(parseTRY('abc'), null);
});

// ---------------- Mağaza sayfası ----------------

test('ana sayfa: yalnızca 3 ürün, tüm adımlar ve form alanları var', async () => {
  const r = await req('/');
  assert.strictEqual(r.status, 200);
  const page = await r.text();
  assert.strictEqual((page.match(/data-product="/g) || []).length, 3);
  for (const t of ['Şemsiye Tipi Isıtıcı', 'Masaj Tabancası', 'Kablosuz Kulaklık', 'Ürünlerinizi Seçin', 'Sepetiniz',
    'Adres Bilgilerinizi Girin', 'Siparişi Tamamla', '%40', '1.799,00', '2.999,00', 'Sepete Ekle',
    'Stok sipariş sonrası teyit edilir']) {
    assert.ok(page.includes(t), `sayfada "${t}" olmalı`);
  }
  for (const f of ['ad', 'soyad', 'telefon', 'eposta', 'il', 'ilce', 'mahalle', 'adres', 'postaKodu', 'not']) {
    assert.match(page, new RegExp(`name="${f}"`), `${f} alanı olmalı`);
  }
  assert.match(page, /<option>Şanlıurfa<\/option>/);
  assert.ok(!/\byorum|değerlendirme|★|☆/i.test(page), 'sahte müşteri yorumu olmamalı');
  assert.match(page, /Yakında/, 'kart ödemesi "Yakında" olarak görünmeli');
  assert.match(page, /value="kart" disabled/, 'kart ödemesi seçilememeli');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
});

test('ödeme yöntemi açık değilse sipariş düğmesi kapalı ve uyarı gösterilir', async () => {
  const page = await (await req('/', {}, { ...env, KAPIDA_ODEME: 'kapali' })).text();
  assert.match(page, /Şu anda online sipariş alınmıyor/);
  assert.match(page, /data-submit disabled/);
  const r = await order({}, { ...env, KAPIDA_ODEME: 'kapali' });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).errors.odeme, /online sipariş alınmıyor/);
});

test('reklam linki: /urun/<kod> ziyareti sayar ve ürünü öne çıkarır', async () => {
  const r = await req('/urun/masaj-tabancasi?utm_source=meta&utm_campaign=video1');
  assert.strictEqual(r.status, 302);
  assert.match(r.headers.get('location'), /\?urun=masaj-tabancasi/);
  assert.match(r.headers.get('set-cookie'), /avm_utm=/);
  const id = sql.prepare(`SELECT id FROM products WHERE slug = 'masaj-tabancasi'`).get().id;
  assert.strictEqual(sql.prepare('SELECT views FROM product_views WHERE product_id = ?').get(id).views, 1);
  assert.match(await (await req('/?urun=masaj-tabancasi')).text(), /"vurgula":"masaj-tabancasi"/);
  assert.strictEqual((await req('/urun/olmayan-urun')).headers.get('location'), '/');
});

// ---------------- Sipariş ----------------

test('sipariş oluşur: tek kayıtta ürünler, adetler, fiyatlar, toplam ve adres', async () => {
  const utm = 'avm_utm=' + encodeURIComponent(JSON.stringify({ utm_source: 'meta', utm_campaign: 'video1' }));
  const r = await order({ eposta: 'ayse@ornek.com', postaKodu: '34710', not: 'Zili çalmayın' }, env, { Cookie: utm });
  assert.strictEqual(r.status, 201);
  const res = await r.json();
  assert.strictEqual(res.ok, true);
  assert.match(res.siparisNo, /^AVM-[A-Z2-9]{8}$/);
  assert.strictEqual(res.ozet.toplam, 2 * 89900 + 69900);
  assert.strictEqual(res.ozet.urunler.length, 2);
  assert.strictEqual(res.ozet.teslimat.mahalle, 'Caferağa');

  const o = sql.prepare('SELECT * FROM orders WHERE order_no = ?').get(res.siparisNo);
  assert.strictEqual(o.subtotal, 249700);
  assert.strictEqual(o.total, 249700);
  assert.strictEqual(o.first_name, 'Ayşe');
  assert.strictEqual(o.last_name, 'Yılmaz');
  assert.strictEqual(o.phone, '05321234567');
  assert.strictEqual(o.email, 'ayse@ornek.com');
  assert.strictEqual(o.postal_code, '34710');
  assert.strictEqual(o.utm_source, 'meta');
  assert.strictEqual(o.status, 'yeni');
  const items = sql.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(o.id);
  assert.deepStrictEqual(items.map((i) => [i.product_name, i.quantity, i.unit_price]),
    [['Masaj Tabancası', 2, 89900], ['Kablosuz Kulaklık', 1, 69900]]);
});

test('tarayıcıdan gelen fiyat yok sayılır, fiyat sunucudan alınır', async () => {
  const r = await order({ sepet: [{ kod: 'kablosuz-kulaklik', adet: 1, fiyat: 1 }], toplam: 1 });
  const res = await r.json();
  assert.strictEqual(res.ozet.toplam, 69900);
});

test('aynı sipariş iki kez gönderilirse tek kayıt oluşur', async () => {
  const anahtar = newKey();
  const before = countOrders();
  const [a, b] = await Promise.all([order({ anahtar }), order({ anahtar })]);
  const ra = await a.json();
  const rb = await b.json();
  assert.strictEqual(ra.siparisNo, rb.siparisNo);
  const c = await (await order({ anahtar })).json();
  assert.strictEqual(c.siparisNo, ra.siparisNo);
  assert.strictEqual(c.tekrar, true);
  assert.strictEqual(countOrders(), before + 1);
});

test('boş sepetle sipariş tamamlanamaz', async () => {
  const before = countOrders();
  const r = await order({ sepet: [] });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).errors.sepet, /Sepetiniz boş/);
  assert.strictEqual(countOrders(), before);
});

test('zorunlu alanlar eksikse anlaşılır Türkçe uyarılar döner', async () => {
  const before = countOrders();
  const r = await order({ ad: '', soyad: '', telefon: '', il: '', ilce: '', mahalle: '', adres: '', onay: false });
  assert.strictEqual(r.status, 400);
  const { errors } = await r.json();
  assert.strictEqual(errors.ad, 'Adınızı yazın.');
  assert.strictEqual(errors.soyad, 'Soyadınızı yazın.');
  assert.match(errors.telefon, /cep telefonu/);
  assert.strictEqual(errors.il, 'İl seçin.');
  assert.strictEqual(errors.ilce, 'İlçe yazın.');
  assert.strictEqual(errors.mahalle, 'Mahalle yazın.');
  assert.match(errors.adres, /açık adresinizi/);
  assert.match(errors.onay, /sözleşmesini onaylayın/);
  assert.strictEqual(countOrders(), before);
});

test('hatalı telefon, e-posta, posta kodu ve il reddedilir', async () => {
  for (const tel of ['123', '0212 123 45 67', '05321234', 'abc']) {
    const { errors } = await (await order({ telefon: tel })).json();
    assert.ok(errors.telefon, `${tel} reddedilmeli`);
  }
  for (const tel of ['05321234567', '5321234567', '+90 532 123 45 67', '(0532) 123-45-67']) {
    const r = await order({ telefon: tel });
    assert.strictEqual(r.status, 201, `${tel} kabul edilmeli`);
  }
  const { errors } = await (await order({ eposta: 'yanlis@', postaKodu: '12', il: 'Atlantis' })).json();
  assert.ok(errors.eposta && errors.postaKodu && errors.il);
});

test('sepet kontrolleri: bilinmeyen ürün, aşırı adet, geçersiz adet', async () => {
  let { errors } = await (await order({ sepet: [{ kod: 'yok-boyle', adet: 1 }] })).json();
  assert.match(errors.sepet, /artık satışta değil/);
  ({ errors } = await (await order({ sepet: [{ kod: 'masaj-tabancasi', adet: 11 }] })).json());
  assert.match(errors.sepet, /en fazla 10/);
  ({ errors } = await (await order({ sepet: [{ kod: 'masaj-tabancasi', adet: -2 }] })).json());
  assert.match(errors.sepet, /Sepetiniz boş/);
  // Aynı ürün iki satırda gelirse birleştirilir
  const res = await (await order({ sepet: [{ kod: 'masaj-tabancasi', adet: 1 }, { kod: 'masaj-tabancasi', adet: 2 }] })).json();
  assert.strictEqual(res.ozet.urunler[0].adet, 3);
});

test('kart ödemesi seçilemez (sanal POS bağlı değil)', async () => {
  const r = await order({ odemeYontemi: 'kart' });
  assert.strictEqual(r.status, 400);
  assert.ok((await r.json()).errors.odeme);
});

test('güvenlik: başka siteden, JSON olmayan, bot ve çok büyük istekler reddedilir', async () => {
  assert.strictEqual((await order({}, env, { Origin: 'https://kotu-site.com' })).status, 403);
  assert.strictEqual((await order({ website: 'spam' })).status, 400);
  const form = await req('/api/siparis', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.strictEqual(form.status, 415);
  const big = await order({ not: 'x'.repeat(30000) });
  assert.strictEqual(big.status, 413);
  const bad = await req('/api/siparis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bozuk' });
  assert.strictEqual(bad.status, 400);
});

test('güvenlik: form alanlarındaki HTML kodu yönetim panelinde zararsız gösterilir', async () => {
  const res = await (await order({ adres: '<script>alert(1)</script> Sokak 5', not: '<img src=x onerror=alert(1)>' })).json();
  const id = sql.prepare('SELECT id FROM orders WHERE order_no = ?').get(res.siparisNo).id;
  const page = await (await req(`/yonetim/siparisler/${id}`, { headers: { Cookie: await adminCookie() } })).text();
  assert.ok(!page.includes('<script>alert(1)</script>'));
  assert.ok(!page.includes('<img src=x'));
  assert.match(page, /&lt;script&gt;/);
});

test('güvenlik: aynı IP\'den çok fazla sipariş denemesi sınırlanır', async () => {
  const ip = { 'cf-connecting-ip': '203.0.113.9' };
  let last;
  for (let i = 0; i < 11; i++) last = await order({ sepet: [] }, env, ip);
  assert.strictEqual(last.status, 429);
});

// ---------------- Yönetim paneli ----------------

test('yönetim paneli şifresiz açılmaz, sipariş bilgileri gizli kalır', async () => {
  for (const u of ['/yonetim', '/yonetim/siparisler', '/yonetim/siparisler/1', '/yonetim/siparisler.csv', '/yonetim/urunler']) {
    const r = await req(u);
    assert.strictEqual(r.status, 302, u);
    assert.strictEqual(r.headers.get('location'), '/yonetim/giris');
  }
  assert.strictEqual((await post('/yonetim/giris', { password: 'yanlis' })).status, 401);
  assert.strictEqual((await req('/yonetim', { headers: { Cookie: 'avm_admin=9999999999999.sahte' } })).status, 302);
});

test('şifre Cloudflare\'de tanımlı değilse panel tamamen kilitlidir (kodda şifre yok)', async () => {
  const noPass = { ...env, ADMIN_PASSWORD: '' };
  assert.match(await (await req('/yonetim/giris', {}, noPass)).text(), /ADMIN_PASSWORD/);
  for (const pw of ['', 'Avm123']) {
    const r = await app.request(`${HOST}/yonetim/giris`, {
      method: 'POST', body: `password=${pw}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, noPass);
    assert.strictEqual(r.status, 503);
  }
});

test('yönetim: sipariş listesi, ayrıntı, CSV ve ürün maliyeti', async () => {
  const cookie = await adminCookie();
  const list = await (await req('/yonetim/siparisler', { headers: { Cookie: cookie } })).text();
  assert.match(list, /Masaj Tabancası ×2, Kablosuz Kulaklık ×1/);
  const csv = await (await req('/yonetim/siparisler.csv', { headers: { Cookie: cookie } })).text();
  assert.match(csv, /neighborhood/);
  assert.match(csv, /Caferağa/);
  const id = sql.prepare(`SELECT id FROM products WHERE slug = 'masaj-tabancasi'`).get().id;
  const r = await post(`/yonetim/urunler/${id}`, { stage: 'potansiyel', unit_cost: '350', shipping_cost: '60' }, { Cookie: cookie });
  assert.strictEqual(r.status, 303);
  const p = sql.prepare('SELECT * FROM products WHERE id = ?').get(id);
  assert.strictEqual(p.unit_cost, 35000);
  assert.strictEqual(p.stage, 'potansiyel');
  assert.strictEqual(p.price, 89900, 'fiyat panelden değişmez, urunler.json\'dan gelir');
  const h = sql.prepare(`SELECT * FROM product_history WHERE product_id = ? AND field = 'unit_cost'`).get(id);
  assert.strictEqual(h.new_value, '35000');
});

test('kâr raporu çok ürünlü siparişte doğru hesaplar (iptal ve test hariç)', async () => {
  const cookie = await adminCookie();
  const heater = sql.prepare(`SELECT id FROM products WHERE slug = 'semsiye-tipi-isitici'`).get().id;
  await post(`/yonetim/urunler/${heater}`, { stage: 'test', unit_cost: '900', shipping_cost: '100' }, { Cookie: cookie });
  const today = todayTR();
  const before = (await productReport(DB, { from: today, to: today })).rows.find((x) => x.id === heater);

  const a = await (await order({ sepet: [{ kod: 'semsiye-tipi-isitici', adet: 2 }] })).json();
  const b = await (await order({ sepet: [{ kod: 'semsiye-tipi-isitici', adet: 1 }] })).json();
  const bId = sql.prepare('SELECT id FROM orders WHERE order_no = ?').get(b.siparisNo).id;
  await post(`/yonetim/siparisler/${bId}`, { status: 'iptal' }, { Cookie: cookie });
  const t = await (await order({ sepet: [{ kod: 'semsiye-tipi-isitici', adet: 5 }] })).json();
  const tId = sql.prepare('SELECT id FROM orders WHERE order_no = ?').get(t.siparisNo).id;
  await post(`/yonetim/siparisler/${tId}`, { is_test: '1' }, { Cookie: cookie });
  await post('/yonetim/reklam', { product_id: String(heater), spend_date: today, channel: 'meta', amount: '500' }, { Cookie: cookie });
  assert.throws(() => sql.prepare('DELETE FROM ad_spend').run(), /silinemez/);

  const after = (await productReport(DB, { from: today, to: today })).rows.find((x) => x.id === heater);
  assert.ok(a.siparisNo);
  assert.strictEqual(after.valid_orders - before.valid_orders, 1);
  assert.strictEqual(after.lost_orders - before.lost_orders, 1);
  assert.strictEqual(after.revenue - before.revenue, 2 * 179900);
  assert.strictEqual(after.cogs - before.cogs, 2 * 90000);
  assert.strictEqual(after.shipping - before.shipping, 10000);
  assert.strictEqual(after.spend - before.spend, 50000);
  assert.strictEqual(after.net_profit - before.net_profit, 2 * 179900 - 2 * 90000 - 10000 - 50000);
});

test('kayıtlar silinemez (ürün, sipariş, sipariş kalemi)', () => {
  assert.throws(() => sql.prepare('DELETE FROM products').run(), /silinemez/);
  assert.throws(() => sql.prepare('DELETE FROM orders').run(), /silinemez/);
  assert.throws(() => sql.prepare('DELETE FROM order_items').run(), /silinemez/);
});

test('tüm sayfalar hatasız açılır', async () => {
  const cookie = await adminCookie();
  const id = sql.prepare('SELECT id FROM orders LIMIT 1').get().id;
  for (const u of ['/yonetim', '/yonetim?aralik=tumu', '/yonetim/urunler', '/yonetim/urunler/1', '/yonetim/siparisler',
    '/yonetim/siparisler?test=1&durum=iptal&urun=1', `/yonetim/siparisler/${id}`, '/yonetim/reklam']) {
    assert.strictEqual((await req(u, { headers: { Cookie: cookie } })).status, 200, u);
  }
  for (const u of ['/iletisim', '/iade-ve-degisim', '/mesafeli-satis-sozlesmesi', '/gizlilik-ve-kvkk']) {
    assert.strictEqual((await req(u)).status, 200, u);
  }
  assert.strictEqual((await req('/yok-boyle-sayfa')).status, 404);
});

// ---------------- Reklam pikselleri ve yönetici test siparişi ----------------

test('piksel kimlikleri doğrulanır; hatalı kimlik yok sayılır', () => {
  const ads = readStore({ META_PIXEL_ID: '123456789012345', TIKTOK_PIXEL_ID: 'C1ABCDEF2345GHIJ', GOOGLE_TAG_ID: 'G-ABC123XYZ' }).ads;
  assert.deepStrictEqual(ads, { meta: '123456789012345', tiktok: 'C1ABCDEF2345GHIJ', google: 'G-ABC123XYZ' });
  const bad = readStore({ META_PIXEL_ID: '<script>', TIKTOK_PIXEL_ID: 'x', GOOGLE_TAG_ID: 'UA-1' }).ads;
  assert.deepStrictEqual(bad, { meta: '', tiktok: '', google: '' });
});

test('piksel yoksa çerez kutusu ve dış kaynak izni yok', async () => {
  const r = await req('/');
  const page = await r.text();
  assert.ok(!page.includes('data-cerez'));
  assert.ok(!page.includes('reklam.js'));
  assert.ok(!r.headers.get('content-security-policy').includes('facebook'));
});

test('piksel tanımlıysa çerez onay kutusu çıkar ve yalnızca ilgili adreslere izin verilir', async () => {
  const r = await req('/', {}, { ...env, META_PIXEL_ID: '123456789012345' });
  const page = await r.text();
  assert.match(page, /data-cerez hidden/);
  assert.match(page, /Reddet/);
  assert.match(page, /\/js\/reklam\.js/);
  assert.match(page, /"meta":"123456789012345"/);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' https:\/\/connect\.facebook\.net/);
  assert.ok(!csp.includes('tiktok') && !csp.includes('google'));
  const kvkk = await (await req('/gizlilik-ve-kvkk', {}, { ...env, META_PIXEL_ID: '123456789012345' })).text();
  assert.match(kvkk, /Meta \(Facebook\/Instagram\)/);
});

test('test siparişi yalnızca yönetici verebilir; raporlara girmez', async () => {
  const off = { ...env, KAPIDA_ODEME: 'kapali' };
  // Ziyaretçi: test seçeneği yok, kullanamaz
  assert.ok(!(await (await req('/', {}, off)).text()).includes('value="test"'));
  const r1 = await order({ odemeYontemi: 'test' }, off);
  assert.strictEqual(r1.status, 400);
  // Yönetici: kapıda ödeme kapalıyken bile test siparişi verebilir
  const cookie = await adminCookie();
  const page = await (await req('/', { headers: { Cookie: cookie } }, off)).text();
  assert.match(page, /value="test"/);
  assert.match(page, /Yönetici olarak giriş yaptınız/);
  assert.ok(!/data-submit disabled/.test(page));
  const r2 = await order({ odemeYontemi: 'test' }, off, { Cookie: cookie });
  assert.strictEqual(r2.status, 201);
  const res = await r2.json();
  assert.strictEqual(res.test, true);
  const o = sql.prepare('SELECT is_test, payment_method FROM orders WHERE order_no = ?').get(res.siparisNo);
  assert.deepStrictEqual([o.is_test, o.payment_method], [1, 'kapida']);
});
