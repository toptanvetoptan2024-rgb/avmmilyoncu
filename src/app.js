const path = require('path');
const express = require('express');
const config = require('./config');
const { formatTRY, toInput } = require('./money');
const { formatDateTime } = require('./time');
const { createProductService, lines, faqItems } = require('./products');
const { createOrderService } = require('./orders');
const payments = require('./payments');
const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admin');

function createApp(db) {
  const app = express();
  const services = {
    db,
    products: createProductService(db),
    orders: createOrderService(db),
    payments,
  };

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '7d' }));
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.locals.config = config;
  app.locals.formatTRY = formatTRY;
  app.locals.toInput = toInput;
  app.locals.formatDateTime = formatDateTime;
  app.locals.lines = lines;
  app.locals.faqItems = faqItems;
  app.locals.testMode = payments.isTestMode();

  app.use((req, res, next) => {
    res.locals.path = req.path;
    res.locals.title = config.siteName;
    res.locals.description = 'AVM Milyoncu – popüler ürünler, uygun fiyat, kapıda ödeme.';
    next();
  });

  app.use('/yonetim', adminRoutes(services));
  app.use('/', shopRoutes(services));

  app.use((req, res) => res.status(404).render('message', {
    title: 'Sayfa bulunamadı', heading: 'Sayfa bulunamadı',
    text: 'Aradığınız sayfa taşınmış veya kaldırılmış olabilir.',
  }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('message', {
      title: 'Hata', heading: 'Bir sorun oluştu', text: 'Lütfen biraz sonra tekrar deneyin.',
    });
  });

  return app;
}

module.exports = { createApp };
