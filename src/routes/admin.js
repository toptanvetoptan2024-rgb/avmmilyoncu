import { Hono } from 'hono';
import { STAGES, ORDER_STATUSES, AD_CHANNELS, PAYMENT_STATUS_LABELS } from '../config.js';
import { parseTRY } from '../money.js';
import { todayTR, daysAgoTR, isDate } from '../time.js';
import { slugify } from '../products.js';
import { productReport, dailySeries, suggestion } from '../reports.js';
import { all } from '../db.js';
import * as auth from '../auth.js';
import * as v from '../views/admin.js';

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_IMAGE = 3 * 1024 * 1024;

export const admin = new Hono();

admin.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');
});

const out = (c, page, status = 200) => c.html(page.toString(), status);

// --- Giriş ---
// Basit deneme sınırı (her Cloudflare sunucusu için ayrı tutulur).
const attempts = new Map();

admin.get('/giris', (c) => out(c, v.loginPage(c.get('ctx'), '', !c.get('ctx').rt.adminPassword)));

admin.post('/giris', async (c) => {
  const rt = c.get('ctx').rt;
  if (!rt.adminPassword) return out(c, v.loginPage(c.get('ctx'), '', true), 503);
  const ip = c.req.header('cf-connecting-ip') || 'yerel';
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 10) return out(c, v.loginPage(c.get('ctx'), 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.'), 429);
  const body = await c.req.parseBody();
  if (await auth.safeEqual(body.password || '', rt.adminPassword)) {
    attempts.delete(ip);
    await auth.login(c, rt.sessionSecret);
    return c.redirect('/yonetim', 302);
  }
  a.n += 1;
  attempts.set(ip, a);
  return out(c, v.loginPage(c.get('ctx'), 'Şifre hatalı.'), 401);
});

admin.post('/cikis', (c) => { auth.logout(c); return c.redirect('/yonetim/giris', 303); });

admin.use('*', async (c, next) => {
  if (!(await auth.isAdmin(c, c.get('ctx').rt.sessionSecret))) return c.redirect('/yonetim/giris', 302);
  return next();
});

// --- Panel / Rapor ---
function range(q) {
  const preset = q.aralik || '7';
  const to = isDate(q.bitis) ? q.bitis : todayTR();
  let from;
  if (isDate(q.baslangic)) from = q.baslangic;
  else if (preset === 'bugun') from = todayTR();
  else if (preset === 'tumu') from = '2000-01-01';
  else from = daysAgoTR(Math.max(0, (Number(preset) || 7) - 1));
  return { from, to, preset: isDate(q.baslangic) ? 'ozel' : preset };
}

admin.get('/', async (c) => {
  const s = c.get('s');
  const r = range(c.req.query());
  const [report, daily, allProducts, newOrders] = await Promise.all([
    productReport(s.db, r),
    dailySeries(s.db, r),
    s.products.listAll(),
    s.db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE status = 'yeni' AND is_test = 0`).first(),
  ]);
  const slots = {};
  STAGES.forEach((st) => { slots[st] = allProducts.filter((p) => p.status === 'aktif' && p.stage === st); });
  return out(c, v.dashboardPage(c.get('ctx'), {
    range: r, report, suggestion, slots, daily: daily.slice(0, 31), newOrders: newOrders.n,
  }));
});

// --- Ürünler ---
admin.get('/urunler', async (c) => out(c, v.productsPage(c.get('ctx'), await c.get('s').products.listAll())));

const emptyProduct = {
  id: null, slug: '', name: '', headline: '', description: '', features: '', faq: '', price: null,
  compare_price: null, unit_cost: 0, shipping_cost: 0, image: '', stage: 'test', status: 'aktif', sort_order: 0,
};

admin.get('/urunler/yeni', (c) => out(c, v.productFormPage(c.get('ctx'), { product: emptyProduct, history: [], errors: [] })));

admin.get('/urunler/:id', async (c) => {
  const s = c.get('s');
  const product = await s.products.getById(c.req.param('id'));
  if (!product) return c.notFound();
  return out(c, v.productFormPage(c.get('ctx'), {
    product, history: await s.products.history(product.id), errors: [], saved: c.req.query('kaydedildi'),
  }));
});

async function saveProduct(c, id) {
  const s = c.get('s');
  const b = await c.req.parseBody();
  const data = {
    name: String(b.name || '').trim(),
    slug: slugify(b.slug || b.name || ''),
    headline: String(b.headline || '').trim(),
    description: String(b.description || '').trim(),
    features: String(b.features || '').trim(),
    faq: String(b.faq || '').trim(),
    price: parseTRY(b.price),
    compare_price: parseTRY(b.compare_price),
    unit_cost: parseTRY(b.unit_cost) ?? 0,
    shipping_cost: parseTRY(b.shipping_cost) ?? 0,
    stage: b.stage,
    status: b.status,
    sort_order: Number.parseInt(b.sort_order, 10) || 0,
  };
  const errors = [];
  const file = b.image_file;
  const hasFile = file && typeof file === 'object' && file.size > 0;
  if (hasFile) {
    if (!IMAGE_TYPES[file.type]) errors.push('Görsel JPG, PNG veya WEBP olmalı.');
    else if (file.size > MAX_IMAGE) errors.push('Görsel en fazla 3 MB olabilir.');
    else if (!c.env.IMAGES) errors.push('Görsel deposu (IMAGES) bağlı değil.');
  } else if (b.image_url !== undefined) {
    data.image = String(b.image_url).trim();
  }

  let result = errors.length ? { errors } : null;
  if (!result) {
    if (hasFile) {
      const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const key = `${Date.now()}-${rand}${IMAGE_TYPES[file.type]}`;
      await c.env.IMAGES.put(key, await file.arrayBuffer(), { metadata: { type: file.type } });
      data.image = `/uploads/${key}`;
    }
    result = id ? await s.products.update(id, data) : await s.products.create(data);
  }
  if (result.errors) {
    const current = id ? await s.products.getById(id) : emptyProduct;
    return out(c, v.productFormPage(c.get('ctx'), {
      product: { ...current, ...data, id }, history: id ? await s.products.history(id) : [], errors: result.errors,
    }), 400);
  }
  return c.redirect(`/yonetim/urunler/${result.id}?kaydedildi=1`, 303);
}

admin.post('/urunler', (c) => saveProduct(c, null));
admin.post('/urunler/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!(await c.get('s').products.getById(id))) return c.notFound();
  return saveProduct(c, id);
});

// --- Siparişler ---
admin.get('/siparisler', async (c) => {
  const s = c.get('s');
  const q = c.req.query();
  const filter = {
    status: ORDER_STATUSES.includes(q.durum) ? q.durum : '',
    productId: Number(q.urun) || 0,
    includeTest: q.test === '1',
  };
  const [orders, products] = await Promise.all([s.orders.list(filter), s.products.listAll()]);
  return out(c, v.ordersPage(c.get('ctx'), { orders, filter, products }));
});

admin.get('/siparisler.csv', async (c) => {
  const rows = await c.get('s').orders.list({ includeTest: c.req.query('test') === '1', limit: 100000 });
  const cols = ['order_no', 'created_at', 'product_name', 'quantity', 'unit_price', 'unit_cost', 'shipping_cost', 'total',
    'status', 'payment_method', 'payment_status', 'is_test', 'customer_name', 'phone', 'city', 'district', 'address', 'note',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const money = new Set(['unit_price', 'unit_cost', 'shipping_cost', 'total']);
  const esc = (val) => {
    let str = String(val ?? '');
    if (/^[=+\-@]/.test(str)) str = "'" + str; // Excel formül enjeksiyonunu önle
    return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [cols.join(';')].concat(rows.map((r) => cols.map((k) => esc(money.has(k) ? (r[k] / 100).toFixed(2).replace('.', ',') : r[k])).join(';')));
  return c.body('﻿' + lines.join('\n'), 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="siparisler-${todayTR()}.csv"`,
  });
});

admin.get('/siparisler/:id', async (c) => {
  const s = c.get('s');
  const order = await s.orders.getById(c.req.param('id'));
  if (!order) return c.notFound();
  return out(c, v.orderPage(c.get('ctx'), { order, events: await s.orders.events(order.id) }));
});

admin.post('/siparisler/:id', async (c) => {
  const s = c.get('s');
  const id = Number(c.req.param('id'));
  const order = await s.orders.getById(id);
  if (!order) return c.notFound();
  const b = await c.req.parseBody();
  if (b.status) await s.orders.setStatus(id, b.status);
  if (b.is_test !== undefined && Boolean(order.is_test) !== (b.is_test === '1')) await s.orders.setTest(id, b.is_test === '1');
  if (b.payment_status && PAYMENT_STATUS_LABELS[b.payment_status] && b.payment_status !== order.payment_status) {
    await s.orders.setPaymentStatus(id, b.payment_status);
  }
  await s.orders.addNote(id, b.note);
  return c.redirect(`/yonetim/siparisler/${id}`, 303);
});

// --- Reklam harcamaları ---
const adList = (db) => all(db.prepare(`SELECT a.*, p.name AS product_name FROM ad_spend a
  JOIN products p ON p.id = a.product_id ORDER BY a.spend_date DESC, a.id DESC LIMIT 300`));

admin.get('/reklam', async (c) => {
  const s = c.get('s');
  return out(c, v.adsPage(c.get('ctx'), {
    list: await adList(s.db), products: await s.products.listAll(), errors: [],
    form: { spend_date: todayTR(), channel: 'meta' },
  }));
});

admin.post('/reklam', async (c) => {
  const s = c.get('s');
  const b = await c.req.parseBody();
  const errors = [];
  const product = await s.products.getById(b.product_id);
  if (!product) errors.push('Ürün seçin.');
  if (!isDate(b.spend_date)) errors.push('Geçerli bir tarih girin.');
  if (!AD_CHANNELS.includes(b.channel)) errors.push('Kanal seçin.');
  const amount = parseTRY(b.amount);
  if (amount === null) errors.push('Harcama tutarını girin.');
  if (errors.length) {
    return out(c, v.adsPage(c.get('ctx'), { list: await adList(s.db), products: await s.products.listAll(), errors, form: b }), 400);
  }
  await s.db.prepare(`INSERT INTO ad_spend (product_id, spend_date, channel, amount, impressions, clicks, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(product.id, b.spend_date, b.channel, amount,
    Math.max(0, Number.parseInt(b.impressions, 10) || 0), Math.max(0, Number.parseInt(b.clicks, 10) || 0),
    String(b.note || '').trim().slice(0, 300)).run();
  return c.redirect('/yonetim/reklam', 303);
});

admin.post('/reklam/:id/gecersiz', async (c) => {
  await c.get('s').db.prepare('UPDATE ad_spend SET voided = 1 - voided WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.redirect('/yonetim/reklam', 303);
});
