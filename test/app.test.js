process.env.DB_PATH = ':memory:';
process.env.ADMIN_PASSWORD = 'test-sifre';
process.env.PAYMENT_MODE = 'test';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'avm-test-uploads');

const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const { createApp } = require('../src/app');
const { productReport } = require('../src/reports');
const { parseTRY } = require('../src/money');
const { todayTR } = require('../src/time');

let server; let base; let db;

test.before(async () => {
  db = open(':memory:');
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const form = (o) => new URLSearchParams(o).toString();
const post = (url, body, headers = {}) => fetch(base + url, {
  method: 'POST', redirect: 'manual', body: form(body),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
});
async function adminCookie() {
  const r = await post('/yonetim/giris', { password: 'test-sifre' });
  assert.strictEqual(r.status, 302);
  return r.headers.get('set-cookie').split(';')[0];
}
const orderBody = (productId, extra = {}) => ({
  product_id: productId, quantity: '2', customer_name: 'Ayşe Yılmaz', phone: '0532 123 45 67',
  city: 'İstanbul', district: 'Kadıköy', address: 'Örnek Mah. Deneme Sok. No: 5 D: 3',
  payment_method: 'kapida', onay: '1', ...extra,
});

test('parseTRY Türkçe tutarları kuruşa çevirir', () => {
  assert.strictEqual(parseTRY('1.299,90'), 129990);
  assert.strictEqual(parseTRY('899'), 89900);
  assert.strictEqual(parseTRY('12.5'), 1250);
  assert.strictEqual(parseTRY('abc'), null);
  assert.strictEqual(parseTRY('-5'), null);
});

test('başlangıçta 3 ürün var ve ana sayfada görünür', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /Elektrikli Isıtıcı/);
  assert.match(html, /Şemsiye/);
  assert.match(html, /Masaj Aleti/);
});

test('ürün sayfası açılır ve ziyaret sayılır', async () => {
  const r = await fetch(base + '/urun/semsiye?utm_source=meta&utm_campaign=kis');
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /Sipariş formu/);
  const v = db.prepare(`SELECT views FROM product_views WHERE product_id = 2`).get();
  assert.strictEqual(v.views, 1);
});

test('kapıda ödemeli sipariş oluşur, UTM ve maliyet kaydedilir', async () => {
  const r = await post('/siparis', orderBody(2), { Cookie: 'avm_utm=' + encodeURIComponent(JSON.stringify({ utm_source: 'meta', utm_campaign: 'kis' })) });
  assert.strictEqual(r.status, 303);
  const loc = r.headers.get('location');
  assert.match(loc, /^\/siparis\/AVM-/);
  const o = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get();
  assert.strictEqual(o.quantity, 2);
  assert.strictEqual(o.total, 2 * 34900);
  assert.strictEqual(o.unit_cost, 12000);
  assert.strictEqual(o.phone, '05321234567');
  assert.strictEqual(o.utm_source, 'meta');
  assert.strictEqual(o.is_test, 0);
  const thanks = await (await fetch(base + loc)).text();
  assert.match(thanks, /Siparişiniz alındı/);
});

test('hatalı form sipariş oluşturmaz', async () => {
  const before = db.prepare('SELECT COUNT(*) n FROM orders').get().n;
  const r = await post('/siparis', orderBody(1, { phone: '123', onay: '' }));
  assert.strictEqual(r.status, 400);
  const html = await r.text();
  assert.match(html, /Geçerli bir cep telefonu/);
  assert.match(html, /sözleşmesini onaylayın/);
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM orders').get().n, before);
});

test('test modunda kartla ödeme simüle edilir ve test siparişi olarak işaretlenir', async () => {
  const r = await post('/siparis', orderBody(1, { payment_method: 'kart' }));
  assert.strictEqual(r.status, 303);
  const loc = r.headers.get('location');
  assert.match(loc, /^\/odeme\/test\//);
  const r2 = await post(loc, { sonuc: 'basarili' });
  assert.strictEqual(r2.status, 303);
  const o = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get();
  assert.strictEqual(o.payment_status, 'odendi');
  assert.strictEqual(o.is_test, 1);
});

test('ürünler, siparişler ve reklam kayıtları silinemez', () => {
  assert.throws(() => db.prepare('DELETE FROM products WHERE id = 1').run(), /silinemez/);
  assert.throws(() => db.prepare('DELETE FROM orders').run(), /silinemez/);
});

test('yönetim paneli şifresiz açılmaz', async () => {
  const r = await fetch(base + '/yonetim', { redirect: 'manual' });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), '/yonetim/giris');
  const bad = await post('/yonetim/giris', { password: 'yanlis' });
  assert.strictEqual(bad.status, 401);
});

test('fiyat değişikliği geçmişe yazılır, eski sipariş etkilenmez', async () => {
  const cookie = await adminCookie();
  const fd = new FormData();
  Object.entries({ name: 'Rüzgara Dayanıklı Şemsiye', slug: 'semsiye', price: '399,90', compare_price: '499', unit_cost: '120', shipping_cost: '50', stage: 'test', status: 'aktif', sort_order: '2', image_url: '/img/semsiye.svg' })
    .forEach(([k, v]) => fd.append(k, v));
  const r = await fetch(base + '/yonetim/urunler/2', { method: 'POST', body: fd, headers: { Cookie: cookie }, redirect: 'manual' });
  assert.strictEqual(r.status, 303);
  const p = db.prepare('SELECT price FROM products WHERE id = 2').get();
  assert.strictEqual(p.price, 39990);
  const h = db.prepare(`SELECT * FROM product_history WHERE product_id = 2 AND field = 'price'`).get();
  assert.strictEqual(h.old_value, '34900');
  assert.strictEqual(h.new_value, '39990');
  const o = db.prepare('SELECT unit_price FROM orders WHERE product_id = 2 ORDER BY id LIMIT 1').get();
  assert.strictEqual(o.unit_price, 34900);
});

test('aşama başına en fazla 3 aktif ürün kuralı', async () => {
  const cookie = await adminCookie();
  const add = (name) => {
    const fd = new FormData();
    Object.entries({ name, price: '100', stage: 'test', status: 'aktif' }).forEach(([k, v]) => fd.append(k, v));
    return fetch(base + '/yonetim/urunler', { method: 'POST', body: fd, headers: { Cookie: cookie }, redirect: 'manual' });
  };
  // 3 başlangıç ürünü zaten "test" aşamasında
  const r = await add('Dördüncü Ürün');
  assert.strictEqual(r.status, 400);
  assert.match(await r.text(), /zaten 3 aktif ürün var/);
  const pasif = new FormData();
  Object.entries({ name: 'Pasif Ürün', price: '100', stage: 'test', status: 'pasif' }).forEach(([k, v]) => pasif.append(k, v));
  const r2 = await fetch(base + '/yonetim/urunler', { method: 'POST', body: pasif, headers: { Cookie: cookie }, redirect: 'manual' });
  assert.strictEqual(r2.status, 303);
  // Pasif ürünün sayfası hâlâ açılır (eski reklam linkleri bozulmaz)
  const page = await fetch(base + '/urun/pasif-urun');
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /şu an satışta değil/);
});

test('kâr raporu reklam, maliyet, iptal ve test siparişlerini doğru hesaplar', async () => {
  const cookie = await adminCookie();
  const today = todayTR();
  const r = await post('/yonetim/reklam', { product_id: '2', spend_date: today, channel: 'meta', amount: '100,00', clicks: '40' }, { Cookie: cookie });
  assert.strictEqual(r.status, 303);
  // Hatalı reklam kaydı geçersiz sayılır, silinmez
  await post('/yonetim/reklam', { product_id: '2', spend_date: today, channel: 'meta', amount: '999' }, { Cookie: cookie });
  const wrong = db.prepare('SELECT id FROM ad_spend ORDER BY id DESC LIMIT 1').get();
  await post(`/yonetim/reklam/${wrong.id}/gecersiz`, {}, { Cookie: cookie });

  // İkinci bir şemsiye siparişi, sonra iptal
  await post('/siparis', orderBody(2, { quantity: '1' }));
  const last = db.prepare('SELECT id FROM orders ORDER BY id DESC LIMIT 1').get();
  await post(`/yonetim/siparisler/${last.id}`, { status: 'iptal' }, { Cookie: cookie });

  const { rows } = productReport(db, { from: today, to: today });
  const s = rows.find((x) => x.id === 2);
  assert.strictEqual(s.spend, 10000);
  assert.strictEqual(s.orders, 2);
  assert.strictEqual(s.valid_orders, 1);
  assert.strictEqual(s.revenue, 69800);           // 2 × 349,00
  assert.strictEqual(s.cogs, 24000);              // 2 × 120,00
  assert.strictEqual(s.shipping, 5000);           // iptalin kargosu yok
  assert.strictEqual(s.net_profit, 69800 - 24000 - 5000 - 10000);
  const isitici = rows.find((x) => x.id === 1);
  assert.strictEqual(isitici.orders, 0, 'test siparişi rapora girmemeli');

  const dash = await fetch(base + '/yonetim', { headers: { Cookie: cookie } });
  assert.strictEqual(dash.status, 200);
  assert.match(await dash.text(), /Ürün performansı/);
});

test('yönetim sayfaları hatasız açılır', async () => {
  const cookie = await adminCookie();
  for (const u of ['/yonetim/urunler', '/yonetim/urunler/1', '/yonetim/urunler/yeni', '/yonetim/siparisler', '/yonetim/siparisler/1', '/yonetim/reklam', '/yonetim/siparisler.csv', '/yonetim?aralik=tumu']) {
    const r = await fetch(base + u, { headers: { Cookie: cookie } });
    assert.strictEqual(r.status, 200, u);
  }
  for (const u of ['/iletisim', '/iade-ve-degisim', '/mesafeli-satis-sozlesmesi', '/gizlilik-ve-kvkk']) {
    assert.strictEqual((await fetch(base + u)).status, 200, u);
  }
  assert.strictEqual((await fetch(base + '/yok-boyle-sayfa')).status, 404);
});
