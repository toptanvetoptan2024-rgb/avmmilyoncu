const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

// Önemli: Bu şemada ürün ve sipariş SİLME yoktur.
// Ürünler "pasif" yapılır, siparişler "iptal"/"iade" durumuna alınır,
// reklam harcamaları "geçersiz" işaretlenir. Böylece performans geçmişi korunur.

const migrations = [
  `
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    headline TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    features TEXT NOT NULL DEFAULT '',      -- her satır bir madde
    faq TEXT NOT NULL DEFAULT '',           -- "Soru? | Cevap" her satır
    price INTEGER NOT NULL,                 -- satış fiyatı (kuruş)
    compare_price INTEGER,                  -- üstü çizili fiyat (kuruş)
    unit_cost INTEGER NOT NULL DEFAULT 0,   -- ürün alış maliyeti (kuruş)
    shipping_cost INTEGER NOT NULL DEFAULT 0, -- bizim ödediğimiz kargo (kuruş)
    image TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT 'test' CHECK (stage IN ('kazanan','potansiyel','test')),
    status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','pasif')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Fiyat, maliyet, aşama ve durum değişikliklerinin kalıcı kaydı.
  CREATE TABLE product_history (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    -- Sipariş anındaki değerler kopyalanır; ürün sonradan değişse de kâr doğru kalır.
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL,
    unit_cost INTEGER NOT NULL,
    shipping_cost INTEGER NOT NULL,
    total INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('kapida','kart')),
    payment_status TEXT NOT NULL DEFAULT 'bekliyor'
      CHECK (payment_status IN ('bekliyor','odendi','basarisiz')),
    status TEXT NOT NULL DEFAULT 'yeni'
      CHECK (status IN ('yeni','onaylandi','kargoda','teslim','iade','iptal')),
    is_test INTEGER NOT NULL DEFAULT 0,
    utm_source TEXT NOT NULL DEFAULT '',
    utm_medium TEXT NOT NULL DEFAULT '',
    utm_campaign TEXT NOT NULL DEFAULT '',
    utm_content TEXT NOT NULL DEFAULT '',
    referrer TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_orders_product_date ON orders(product_id, created_at);

  CREATE TABLE order_events (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    event TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Günlük reklam harcaması (ürün + kanal bazında).
  CREATE TABLE ad_spend (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    spend_date TEXT NOT NULL,               -- YYYY-MM-DD
    channel TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    voided INTEGER NOT NULL DEFAULT 0,      -- silmek yerine geçersiz say
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_ad_spend_product_date ON ad_spend(product_id, spend_date);

  -- Ürün sayfası günlük ziyaret sayacı (dönüşüm oranı için).
  CREATE TABLE product_views (
    product_id INTEGER NOT NULL REFERENCES products(id),
    view_date TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, view_date)
  );

  -- Silmeyi veritabanı seviyesinde de engelle.
  CREATE TRIGGER no_delete_products BEFORE DELETE ON products
    BEGIN SELECT RAISE(ABORT, 'Ürünler silinemez, pasif yapın.'); END;
  CREATE TRIGGER no_delete_orders BEFORE DELETE ON orders
    BEGIN SELECT RAISE(ABORT, 'Siparişler silinemez, iptal edin.'); END;
  CREATE TRIGGER no_delete_ad_spend BEFORE DELETE ON ad_spend
    BEGIN SELECT RAISE(ABORT, 'Reklam kayıtları silinemez, geçersiz sayın.'); END;
  CREATE TRIGGER no_delete_history BEFORE DELETE ON product_history
    BEGIN SELECT RAISE(ABORT, 'Geçmiş kayıtları silinemez.'); END;
  `,
];

const seedProducts = [
  {
    slug: 'elektrikli-isitici',
    name: 'Elektrikli Isıtıcı',
    headline: 'Saniyeler içinde sıcacık bir oda',
    description: 'Kompakt tasarımı ve sessiz çalışmasıyla ev ve ofis için pratik ısınma çözümü.',
    features: 'Hızlı ısınma\nSessiz çalışma\nDevrilme emniyeti\nKolay taşınır kompakt gövde',
    faq: 'Kargo ne zaman çıkar? | Siparişler 1-2 iş günü içinde kargoya verilir.\nKapıda ödeme var mı? | Evet, kapıda nakit veya kartla ödeyebilirsiniz.',
    price: 89900, compare_price: 129900, unit_cost: 42000, shipping_cost: 6000,
    image: '/img/isitici.svg', sort_order: 1,
  },
  {
    slug: 'semsiye',
    name: 'Rüzgara Dayanıklı Şemsiye',
    headline: 'Rüzgarda ters dönmeyen sağlam şemsiye',
    description: 'Güçlendirilmiş iskeleti ve tek tuşla açılıp kapanma özelliğiyle her havaya hazır.',
    features: 'Rüzgara dayanıklı iskelet\nTek tuşla aç-kapa\nSu itici kumaş\nÇantaya sığar',
    faq: 'Kargo ne zaman çıkar? | Siparişler 1-2 iş günü içinde kargoya verilir.\nKapıda ödeme var mı? | Evet, kapıda nakit veya kartla ödeyebilirsiniz.',
    price: 34900, compare_price: 49900, unit_cost: 12000, shipping_cost: 5000,
    image: '/img/semsiye.svg', sort_order: 2,
  },
  {
    slug: 'masaj-aleti',
    name: 'Masaj Aleti',
    headline: 'Günün yorgunluğunu dakikalar içinde atın',
    description: 'Farklı yoğunluk seviyeleriyle boyun, sırt ve bacaklar için rahatlatıcı masaj.',
    features: 'Çok kademeli yoğunluk\nŞarjlı, kablosuz kullanım\nFarklı masaj başlıkları\nSessiz motor',
    faq: 'Kargo ne zaman çıkar? | Siparişler 1-2 iş günü içinde kargoya verilir.\nKapıda ödeme var mı? | Evet, kapıda nakit veya kartla ödeyebilirsiniz.',
    price: 59900, compare_price: 89900, unit_cost: 25000, shipping_cost: 6000,
    image: '/img/masaj.svg', sort_order: 3,
  },
];

function open(dbPath = config.dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const version = db.pragma('user_version', { simple: true });
  for (let v = version; v < migrations.length; v++) {
    db.transaction(() => {
      db.exec(migrations[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count === 0) {
    const insert = db.prepare(`INSERT INTO products
      (slug, name, headline, description, features, faq, price, compare_price, unit_cost, shipping_cost, image, sort_order)
      VALUES (@slug, @name, @headline, @description, @features, @faq, @price, @compare_price, @unit_cost, @shipping_cost, @image, @sort_order)`);
    db.transaction(() => seedProducts.forEach((p) => insert.run(p)))();
  }
  return db;
}

module.exports = { open };
