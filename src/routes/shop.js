const express = require('express');
const config = require('../config');
const { todayTR } = require('../time');
const { isAdmin, parseCookies } = require('../auth');

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless/i;

module.exports = function shopRoutes({ db, products, orders, payments }) {
  const router = express.Router();

  const countView = db.prepare(`INSERT INTO product_views (product_id, view_date, views) VALUES (?, ?, 1)
    ON CONFLICT(product_id, view_date) DO UPDATE SET views = views + 1`);

  // Reklamdan gelen UTM bilgilerini 30 gün sakla; sipariş hangi reklamdan geldi görülsün.
  router.use((req, res, next) => {
    const utm = {};
    UTM_KEYS.forEach((k) => { if (req.query[k]) utm[k] = String(req.query[k]).slice(0, 200); });
    if (Object.keys(utm).length) {
      res.cookie('avm_utm', JSON.stringify(utm), { maxAge: 30 * 86400000, sameSite: 'lax', httpOnly: true });
      req.utm = utm;
    } else {
      try { req.utm = JSON.parse(parseCookies(req).avm_utm || '{}'); } catch { req.utm = {}; }
    }
    next();
  });

  router.get('/', (req, res) => {
    res.render('home', { products: products.listActive() });
  });

  router.get('/urun/:slug', (req, res, next) => {
    const product = products.getBySlug(req.params.slug);
    if (!product) return next();
    if (product.status === 'aktif' && !isAdmin(req) && !BOT_RE.test(req.get('user-agent') || '')) {
      countView.run(product.id, todayTR());
    }
    // Pasif ürünün sayfası silinmez: eski reklam linkleri diğer ürünlere yönlendirir.
    res.render('product', {
      title: `${product.name} | ${config.siteName}`,
      description: product.headline || product.description,
      product,
      others: products.listActive().filter((p) => p.id !== product.id).slice(0, 3),
      methods: payments.availableMethods(),
      form: { quantity: 1, payment_method: 'kapida' },
      errors: [],
    });
  });

  router.post('/siparis', (req, res, next) => {
    const product = products.getById(Number(req.body.product_id));
    if (!product) return next();
    // Bot tuzağı: gerçek kullanıcı bu alanı görmez.
    if (req.body.website) return res.redirect(`/urun/${product.slug}`);
    if (req.body.payment_method && !payments.availableMethods()[req.body.payment_method]) {
      req.body.payment_method = '';
    }
    const errors = [];
    if (!req.body.onay) errors.push('Mesafeli satış sözleşmesini onaylayın.');
    const isCardTest = req.body.payment_method === 'kart' && payments.isTestMode();
    const result = orders.create({
      ...req.body,
      preErrors: errors,
      product,
      ...req.utm,
      referrer: req.get('referer') || '',
      is_test: isCardTest,
    });
    if (result.errors) {
      return res.status(400).render('product', {
        title: `${product.name} | ${config.siteName}`,
        description: product.headline,
        product,
        others: [],
        methods: payments.availableMethods(),
        form: req.body,
        errors: result.errors,
      });
    }
    const next_ = payments.start(result.order);
    return res.redirect(303, next_.redirect);
  });

  router.get('/siparis/:no', (req, res, next) => {
    const order = orders.getByNo(req.params.no);
    if (!order) return next();
    res.render('thanks', { title: 'Siparişiniz alındı', order });
  });

  // TEST ödeme sayfası: yalnızca test modunda çalışır, gerçek para çekilmez.
  router.get('/odeme/test/:no', (req, res, next) => {
    if (!payments.isTestMode()) return next();
    const order = orders.getByNo(req.params.no);
    if (!order || order.payment_method !== 'kart') return next();
    res.render('test-payment', { title: 'Test ödeme', order });
  });

  router.post('/odeme/test/:no', (req, res, next) => {
    if (!payments.isTestMode()) return next();
    const order = orders.getByNo(req.params.no);
    if (!order || order.payment_method !== 'kart' || order.payment_status !== 'bekliyor') return next();
    const ok = req.body.sonuc === 'basarili';
    orders.setPaymentStatus(order.id, ok ? 'odendi' : 'basarisiz', ok ? 'TEST ödeme başarılı' : 'TEST ödeme başarısız');
    if (!ok) orders.setStatus(order.id, 'iptal');
    res.redirect(303, `/siparis/${order.order_no}`);
  });

  const pages = {
    'iletisim': 'İletişim',
    'iade-ve-degisim': 'İade ve Değişim',
    'mesafeli-satis-sozlesmesi': 'Mesafeli Satış Sözleşmesi',
    'gizlilik-ve-kvkk': 'Gizlilik ve KVKK',
  };
  router.get('/:page', (req, res, next) => {
    const t = pages[req.params.page];
    if (!t) return next();
    res.render(`pages/${req.params.page}`, { title: `${t} | ${config.siteName}`, heading: t });
  });

  return router;
};
