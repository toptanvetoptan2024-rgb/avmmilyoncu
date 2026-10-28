import test from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/index.js';
import { productReport } from '../src/reports.js';
import { parseTRY } from '../src/money.js';
import { todayTR } from '../src/time.js';
import { createD1, createKV } from './d1-shim.js';

const DB = createD1();
const IMAGES = createKV();
const env = { DB, IMAGES, ADMIN_PASSWORD: 'test-sifre', PAYMENT_MODE: 'test' };
const app = createApp();
const sql = DB.raw;

const req = (path, init = {}, e = env) => app.request('http://localhost' + path, { redirect: 'manual', ...init }, e);
const post = (path, body, headers = {}) => req(path, {
  method: 'POST',
  body: new URLSearchParams(body).toString(),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
});
const postForm = (path, fields, cookie) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return req(path, { method: 'POST', body: fd, headers: { Cookie: cookie } });
};
async function adminCookie() {
  const r = await post('/yonetim/giris', { password: 'test-sifre' });
  assert.strictEqual(r.status, 302);
  return r.headers.get('set-cookie').split(';')[0];
}
const orderBody = (productId, extra = {}) => ({
  product_id: String(productId), quantity: '2', customer_name: 'Ayşe Yılmaz', phone: '0532 123 45 67',
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

test('ana sayfa açılır ve 3 örnek ürün görünür', async () => {
  const r = await req('/');
  assert.strictEqual(r.status, 200);
  const page = await r.text();
  assert.match(page, /Elektrikli Isıtıcı/);
  assert.match(page, /Rüzgara Dayanıklı Şemsiye/);
  assert.match(page, /Masaj Aleti/);
  assert.match(page, /TEST MODU/);
});

test('ürün sayfası açılır, ziyaret sayılır, UTM çerezi yazılır', async () => {
  const r = await req('/urun/semsiye?utm_source=meta&utm_campaign=kis');
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /Sipariş formu/);
  assert.match(r.headers.get('set-cookie'), /avm_utm=/);
  assert.strictEqual(sql.prepare('SELECT views FROM product_views WHERE product_id = 2').get().views, 1);
});

test('kapıda ödemeli sipariş oluşur, UTM ve maliyet kaydedilir', async () => {
  const utm = 'avm_utm=' + encodeURIComponent(JSON.stringify({ utm_source: 'meta', utm_campaign: 'kis' }));
  const r = await post('/siparis', orderBody(2), { Cookie: utm });
  assert.strictEqual(r.status, 303);
  const loc = r.headers.get('location');
  assert.match(loc, /^\/siparis\/AVM-/);
  const o = sql.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get();
  assert.strictEqual(o.quantity, 2);
  assert.strictEqual(o.total, 2 * 34900);
  assert.strictEqual(o.unit_cost, 12000);
  assert.strictEqual(o.phone, '05321234567');
  assert.strictEqual(o.utm_source, 'meta');
  assert.strictEqual(o.is_test, 0);
  assert.strictEqual(sql.prepare('SELECT COUNT(*) n FROM order_events WHERE order_id = ?').get(o.id).n, 1);
  assert.match(await (await req(loc)).text(), /Siparişiniz alındı/);
});

test('hatalı form sipariş oluşturmaz ve tüm hataları birlikte gösterir', async () => {
  const before = sql.prepare('SELECT COUNT(*) n FROM orders').get().n;
  const r = await post('/siparis', orderBody(1, { phone: '123', onay: '' }));
  assert.strictEqual(r.status, 400);
  const page = await r.text();
  assert.match(page, /Geçerli bir cep telefonu/);
  assert.match(page, /sözleşmesini onaylayın/);
  assert.strictEqual(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, before);
});

test('form alanlarındaki HTML kodu zararsız hale getirilir', async () => {
  const r = await post('/siparis', orderBody(1, { customer_name: '<script>alert(1)</script>', phone: '1' }));
  const page = await r.text();
  assert.ok(!page.includes('<script>alert(1)</script>'));
  assert.match(page, /&lt;script&gt;/);
});

test('test modunda kartla ödeme simüle edilir ve test siparişi olarak işaretlenir', async () => {
  const r = await post('/siparis', orderBody(1, { payment_method: 'kart' }));
  assert.strictEqual(r.status, 303);
  const loc = r.headers.get('location');
  assert.match(loc, /^\/odeme\/test\//);
  assert.match(await (await req(loc)).text(), /Test ödeme ekranı/);
  assert.strictEqual((await post(loc, { sonuc: 'basarili' })).status, 303);
  const o = sql.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get();
  assert.strictEqual(o.payment_status, 'odendi');
  assert.strictEqual(o.is_test, 1);
});

test('canlı modda gerçek ödeme bağlı olmadığı için kart seçeneği görünmez', async () => {
  const r = await req('/urun/semsiye', {}, { ...env, PAYMENT_MODE: 'live' });
  const page = await r.text();
  assert.ok(!page.includes('value="kart"'));
  assert.ok(!page.includes('TEST MODU'));
});

test('ürünler, siparişler ve reklam kayıtları silinemez', () => {
  assert.throws(() => sql.prepare('DELETE FROM products WHERE id = 1').run(), /silinemez/);
  assert.throws(() => sql.prepare('DELETE FROM orders').run(), /silinemez/);
});

test('yönetim paneli şifresiz açılmaz', async () => {
  const r = await req('/yonetim');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), '/yonetim/giris');
  assert.strictEqual((await post('/yonetim/giris', { password: 'yanlis' })).status, 401);
  assert.strictEqual((await req('/yonetim', { headers: { Cookie: 'avm_admin=9999999999999.sahte' } })).status, 302);
});

test('geçici şifre (Avm123) ile giriş yapılır ve uyarı gösterilir', async () => {
  const noSecret = { ...env, ADMIN_PASSWORD: '' };
  const r = await app.request('http://localhost/yonetim/giris', {
    method: 'POST', redirect: 'manual', body: 'password=Avm123', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, noSecret);
  assert.strictEqual(r.status, 302);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const panel = await app.request('http://localhost/yonetim', { headers: { Cookie: cookie } }, noSecret);
  assert.strictEqual(panel.status, 200);
  assert.match(await panel.text(), /Geçici yönetim şifresi/);
  // Cloudflare'de ayrı bir şifre tanımlıysa o da çalışır
  assert.strictEqual((await post('/yonetim/giris', { password: ' test-sifre ' })).status, 302);
});

test('fiyat değişikliği geçmişe yazılır, eski sipariş etkilenmez', async () => {
  const cookie = await adminCookie();
  const r = await postForm('/yonetim/urunler/2', {
    name: 'Rüzgara Dayanıklı Şemsiye', slug: 'semsiye', price: '399,90', compare_price: '499', unit_cost: '120',
    shipping_cost: '50', stage: 'test', status: 'aktif', sort_order: '2', image_url: '/img/semsiye.svg',
  }, cookie);
  assert.strictEqual(r.status, 303);
  assert.strictEqual(sql.prepare('SELECT price FROM products WHERE id = 2').get().price, 39990);
  const h = sql.prepare(`SELECT * FROM product_history WHERE product_id = 2 AND field = 'price'`).get();
  assert.strictEqual(h.old_value, '34900');
  assert.strictEqual(h.new_value, '39990');
  assert.strictEqual(sql.prepare('SELECT unit_price FROM orders WHERE product_id = 2 ORDER BY id LIMIT 1').get().unit_price, 34900);
});

test('ürün görseli yüklenir ve sitede gösterilir', async () => {
  const cookie = await adminCookie();
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const r = await postForm('/yonetim/urunler/3', {
    name: 'Masaj Aleti', slug: 'masaj-aleti', price: '599', stage: 'test', status: 'aktif',
    image_file: new File([png], 'foto.png', { type: 'image/png' }),
  }, cookie);
  assert.strictEqual(r.status, 303);
  const image = sql.prepare('SELECT image FROM products WHERE id = 3').get().image;
  assert.match(image, /^\/uploads\/.+\.png$/);
  const img = await req(image);
  assert.strictEqual(img.status, 200);
  assert.strictEqual(img.headers.get('content-type'), 'image/png');
});

test('aşama başına en fazla 3 aktif ürün kuralı ve pasif ürün sayfası', async () => {
  const cookie = await adminCookie();
  const r = await postForm('/yonetim/urunler', { name: 'Dördüncü Ürün', price: '100', stage: 'test', status: 'aktif' }, cookie);
  assert.strictEqual(r.status, 400);
  assert.match(await r.text(), /zaten 3 aktif ürün var/);
  const r2 = await postForm('/yonetim/urunler', { name: 'Pasif Ürün', price: '100', stage: 'test', status: 'pasif' }, cookie);
  assert.strictEqual(r2.status, 303);
  const page = await req('/urun/pasif-urun');
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /şu an satışta değil/);
  const r3 = await postForm('/yonetim/urunler', { name: 'Yeni Kazanan', price: '100', stage: 'kazanan', status: 'aktif' }, cookie);
  assert.strictEqual(r3.status, 303);
});

test('kâr raporu reklam, maliyet, iptal ve test siparişlerini doğru hesaplar', async () => {
  const cookie = await adminCookie();
  const today = todayTR();
  assert.strictEqual((await post('/yonetim/reklam', { product_id: '2', spend_date: today, channel: 'meta', amount: '100,00', clicks: '40' }, { Cookie: cookie })).status, 303);
  await post('/yonetim/reklam', { product_id: '2', spend_date: today, channel: 'meta', amount: '999' }, { Cookie: cookie });
  const wrong = sql.prepare('SELECT id FROM ad_spend ORDER BY id DESC LIMIT 1').get();
  await post(`/yonetim/reklam/${wrong.id}/gecersiz`, {}, { Cookie: cookie });
  assert.throws(() => sql.prepare('DELETE FROM ad_spend').run(), /silinemez/);

  // İkinci bir şemsiye siparişi (yeni fiyatla), sonra iptal
  await post('/siparis', orderBody(2, { quantity: '1' }));
  const last = sql.prepare('SELECT id FROM orders ORDER BY id DESC LIMIT 1').get();
  await post(`/yonetim/siparisler/${last.id}`, { status: 'iptal' }, { Cookie: cookie });

  const { rows } = await productReport(DB, { from: today, to: today });
  const s = rows.find((x) => x.id === 2);
  assert.strictEqual(s.spend, 10000);
  assert.strictEqual(s.orders, 2);
  assert.strictEqual(s.valid_orders, 1);
  assert.strictEqual(s.revenue, 69800); // 2 × 349,00 (sipariş anındaki fiyat)
  assert.strictEqual(s.cogs, 24000); // 2 × 120,00
  assert.strictEqual(s.shipping, 5000); // iptal edilenin kargosu yok
  assert.strictEqual(s.net_profit, 69800 - 24000 - 5000 - 10000);
  assert.strictEqual(rows.find((x) => x.id === 1).orders, 0, 'test siparişi rapora girmemeli');
});

test('tüm sayfalar hatasız açılır', async () => {
  const cookie = await adminCookie();
  for (const u of ['/yonetim', '/yonetim?aralik=tumu', '/yonetim?aralik=bugun', '/yonetim/urunler', '/yonetim/urunler/1',
    '/yonetim/urunler/yeni', '/yonetim/siparisler', '/yonetim/siparisler?test=1&durum=iptal', '/yonetim/siparisler/1',
    '/yonetim/reklam', '/yonetim/siparisler.csv']) {
    const r = await req(u, { headers: { Cookie: cookie } });
    assert.strictEqual(r.status, 200, u);
  }
  for (const u of ['/iletisim', '/iade-ve-degisim', '/mesafeli-satis-sozlesmesi', '/gizlilik-ve-kvkk']) {
    assert.strictEqual((await req(u)).status, 200, u);
  }
  assert.strictEqual((await req('/yok-boyle-sayfa')).status, 404);
  assert.strictEqual((await req('/urun/yok')).status, 404);
});
