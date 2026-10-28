const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const { parseTRY } = require('../money');
const { todayTR, daysAgoTR, isDate } = require('../time');
const { slugify } = require('../products');
const { productReport, dailySeries, suggestion } = require('../reports');
const auth = require('../auth');

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

module.exports = function adminRoutes({ db, products, orders }) {
  const router = express.Router();
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: config.uploadDir,
      filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
    }),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
  });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.locals.path = req.path;
    next();
  });

  // --- Giriş ---
  const attempts = new Map();
  router.get('/giris', (req, res) => res.render('admin/login', { title: 'Yönetim girişi', error: '' }));
  router.post('/giris', (req, res) => {
    const key = req.ip;
    const a = attempts.get(key) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 15 * 60000) { a.n = 0; a.t = Date.now(); }
    if (a.n >= 10) {
      return res.status(429).render('admin/login', { title: 'Yönetim girişi', error: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' });
    }
    if (auth.safeEqual(req.body.password || '', config.adminPassword)) {
      attempts.delete(key);
      auth.login(res, req);
      return res.redirect('/yonetim');
    }
    a.n += 1;
    attempts.set(key, a);
    return res.status(401).render('admin/login', { title: 'Yönetim girişi', error: 'Şifre hatalı.' });
  });
  router.post('/cikis', (req, res) => { auth.logout(res); res.redirect('/yonetim/giris'); });

  router.use(auth.requireAdmin);

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

  router.get('/', (req, res) => {
    const r = range(req.query);
    const report = productReport(db, r);
    const all = products.listAll();
    const slots = {};
    config.stages.forEach((s) => { slots[s] = all.filter((p) => p.status === 'aktif' && p.stage === s); });
    res.render('admin/dashboard', {
      title: 'Panel', range: r, report, suggestion, slots,
      daily: dailySeries(db, r).slice(0, 31),
      newOrders: db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE status = 'yeni' AND is_test = 0`).get().n,
    });
  });

  // --- Ürünler ---
  router.get('/urunler', (req, res) => res.render('admin/products', { title: 'Ürünler', products: products.listAll() }));

  const emptyProduct = {
    id: null, slug: '', name: '', headline: '', description: '', features: '', faq: '', price: null,
    compare_price: null, unit_cost: 0, shipping_cost: 0, image: '', stage: 'test', status: 'aktif', sort_order: 0,
  };

  router.get('/urunler/yeni', (req, res) => res.render('admin/product-form', {
    title: 'Yeni ürün', product: emptyProduct, history: [], errors: [],
  }));

  router.get('/urunler/:id', (req, res, next) => {
    const product = products.getById(Number(req.params.id));
    if (!product) return next();
    res.render('admin/product-form', {
      title: product.name, product, history: products.history(product.id), errors: [], saved: req.query.kaydedildi,
    });
  });

  function readProductForm(req) {
    const b = req.body;
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
    if (req.file) data.image = '/uploads/' + req.file.filename;
    else if (b.image_url !== undefined) data.image = String(b.image_url).trim();
    return data;
  }

  function saveProduct(req, res, id) {
    const data = readProductForm(req);
    const result = id ? products.update(id, data) : products.create(data);
    if (result.errors) {
      if (req.file) fs.unlink(req.file.path, () => {});
      const current = id ? products.getById(id) : emptyProduct;
      return res.status(400).render('admin/product-form', {
        title: data.name || 'Ürün', product: { ...current, ...data, id }, history: id ? products.history(id) : [], errors: result.errors,
      });
    }
    return res.redirect(303, `/yonetim/urunler/${result.id}?kaydedildi=1`);
  }

  router.post('/urunler', upload.single('image_file'), (req, res) => saveProduct(req, res, null));
  router.post('/urunler/:id', upload.single('image_file'), (req, res, next) => {
    const id = Number(req.params.id);
    if (!products.getById(id)) return next();
    return saveProduct(req, res, id);
  });

  // --- Siparişler ---
  router.get('/siparisler', (req, res) => {
    const filter = {
      status: config.orderStatuses.includes(req.query.durum) ? req.query.durum : '',
      productId: Number(req.query.urun) || 0,
      includeTest: req.query.test === '1',
    };
    res.render('admin/orders', { title: 'Siparişler', orders: orders.list(filter), filter, products: products.listAll() });
  });

  router.get('/siparisler.csv', (req, res) => {
    const rows = orders.list({ includeTest: req.query.test === '1', limit: 100000 });
    const cols = ['order_no', 'created_at', 'product_name', 'quantity', 'unit_price', 'unit_cost', 'shipping_cost', 'total',
      'status', 'payment_method', 'payment_status', 'is_test', 'customer_name', 'phone', 'city', 'district', 'address', 'note',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
    const money = new Set(['unit_price', 'unit_cost', 'shipping_cost', 'total']);
    const esc = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = "'" + s; // Excel formül enjeksiyonunu önle
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = [cols.join(';')].concat(rows.map((r) => cols.map((c) => esc(money.has(c) ? (r[c] / 100).toFixed(2).replace('.', ',') : r[c])).join(';')));
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="siparisler-${todayTR()}.csv"`);
    res.send('﻿' + body.join('\n'));
  });

  router.get('/siparisler/:id', (req, res, next) => {
    const order = orders.getById(Number(req.params.id));
    if (!order) return next();
    res.render('admin/order', { title: order.order_no, order, events: orders.events(order.id) });
  });

  router.post('/siparisler/:id', (req, res, next) => {
    const id = Number(req.params.id);
    const order = orders.getById(id);
    if (!order) return next();
    if (req.body.status) orders.setStatus(id, req.body.status);
    if (req.body.is_test !== undefined) {
      const t = req.body.is_test === '1';
      if (Boolean(order.is_test) !== t) orders.setTest(id, t);
    }
    if (req.body.payment_status && ['bekliyor', 'odendi', 'basarisiz'].includes(req.body.payment_status)
      && req.body.payment_status !== order.payment_status) {
      orders.setPaymentStatus(id, req.body.payment_status);
    }
    orders.addNote(id, req.body.note);
    res.redirect(303, `/yonetim/siparisler/${id}`);
  });

  // --- Reklam harcamaları ---
  router.get('/reklam', (req, res) => {
    const list = db.prepare(`SELECT a.*, p.name AS product_name FROM ad_spend a JOIN products p ON p.id = a.product_id
      ORDER BY a.spend_date DESC, a.id DESC LIMIT 300`).all();
    res.render('admin/ads', {
      title: 'Reklam harcamaları', list, products: products.listAll(), errors: [],
      form: { spend_date: todayTR(), channel: 'meta' },
    });
  });

  router.post('/reklam', (req, res) => {
    const b = req.body;
    const errors = [];
    const product = products.getById(Number(b.product_id));
    if (!product) errors.push('Ürün seçin.');
    if (!isDate(b.spend_date)) errors.push('Geçerli bir tarih girin.');
    if (!config.adChannels.includes(b.channel)) errors.push('Kanal seçin.');
    const amount = parseTRY(b.amount);
    if (amount === null) errors.push('Harcama tutarını girin.');
    if (errors.length) {
      const list = db.prepare(`SELECT a.*, p.name AS product_name FROM ad_spend a JOIN products p ON p.id = a.product_id
        ORDER BY a.spend_date DESC, a.id DESC LIMIT 300`).all();
      return res.status(400).render('admin/ads', { title: 'Reklam harcamaları', list, products: products.listAll(), errors, form: b });
    }
    db.prepare(`INSERT INTO ad_spend (product_id, spend_date, channel, amount, impressions, clicks, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(product.id, b.spend_date, b.channel, amount,
      Math.max(0, Number.parseInt(b.impressions, 10) || 0), Math.max(0, Number.parseInt(b.clicks, 10) || 0),
      String(b.note || '').trim().slice(0, 300));
    res.redirect(303, '/yonetim/reklam');
  });

  router.post('/reklam/:id/gecersiz', (req, res) => {
    db.prepare('UPDATE ad_spend SET voided = 1 - voided WHERE id = ?').run(Number(req.params.id));
    res.redirect(303, '/yonetim/reklam');
  });

  return router;
};

