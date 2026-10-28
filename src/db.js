// Cloudflare D1 veritabanı şeması.
//
// Önemli: Bu şemada ürün ve sipariş SİLME yoktur.
// Ürünler "pasif" yapılır, siparişler "iptal"/"iade" durumuna alınır,
// reklam harcamaları "geçersiz" işaretlenir. Böylece performans geçmişi korunur.
//
// Tablolar ilk istekte otomatik oluşturulur; ayrıca bir kurulum komutu gerekmez.
// Yeni bir değişiklik gerektiğinde MIGRATIONS listesinin SONUNA eklenir.

const MIGRATIONS = [
  [
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      headline TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      features TEXT NOT NULL DEFAULT '',
      faq TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL,
      compare_price INTEGER,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      shipping_cost INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'test' CHECK (stage IN ('kazanan','potansiyel','test')),
      status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','pasif')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS product_history (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL REFERENCES products(id),
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
      payment_status TEXT NOT NULL DEFAULT 'bekliyor' CHECK (payment_status IN ('bekliyor','odendi','basarisiz')),
      status TEXT NOT NULL DEFAULT 'yeni' CHECK (status IN ('yeni','onaylandi','kargoda','teslim','iade','iptal')),
      is_test INTEGER NOT NULL DEFAULT 0,
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_orders_product_date ON orders(product_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      event TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ad_spend (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      spend_date TEXT NOT NULL,
      channel TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount >= 0),
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      voided INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ad_spend_product_date ON ad_spend(product_id, spend_date)`,
    `CREATE TABLE IF NOT EXISTS product_views (
      product_id INTEGER NOT NULL REFERENCES products(id),
      view_date TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, view_date)
    )`,
    `CREATE TRIGGER IF NOT EXISTS no_delete_products BEFORE DELETE ON products
      BEGIN SELECT RAISE(ABORT, 'Ürünler silinemez, pasif yapın.'); END`,
    `CREATE TRIGGER IF NOT EXISTS no_delete_orders BEFORE DELETE ON orders
      BEGIN SELECT RAISE(ABORT, 'Siparişler silinemez, iptal edin.'); END`,
    `CREATE TRIGGER IF NOT EXISTS no_delete_ad_spend BEFORE DELETE ON ad_spend
      BEGIN SELECT RAISE(ABORT, 'Reklam kayıtları silinemez, geçersiz sayın.'); END`,
    `CREATE TRIGGER IF NOT EXISTS no_delete_history BEFORE DELETE ON product_history
      BEGIN SELECT RAISE(ABORT, 'Geçmiş kayıtları silinemez.'); END`,
  ],
];

const SEED_PRODUCTS = [
  {
    slug: 'elektrikli-isitici',
    name: 'Elektrikli Isıtıcı',
    headline: 'Saniyeler içinde sıcacık bir oda',
    description: 'Kompakt tasarımı ve sessiz çalışmasıyla ev ve ofis için pratik ısınma çözümü.',
    features: 'Hızlı ısınma\nSessiz çalışma\nDevrilme emniyeti\nKolay taşınır kompakt gövde',
    price: 89900, compare_price: 129900, unit_cost: 42000, shipping_cost: 6000,
    image: '/img/isitici.svg', sort_order: 1,
  },
  {
    slug: 'semsiye',
    name: 'Rüzgara Dayanıklı Şemsiye',
    headline: 'Rüzgarda ters dönmeyen sağlam şemsiye',
    description: 'Güçlendirilmiş iskeleti ve tek tuşla açılıp kapanma özelliğiyle her havaya hazır.',
    features: 'Rüzgara dayanıklı iskelet\nTek tuşla aç-kapa\nSu itici kumaş\nÇantaya sığar',
    price: 34900, compare_price: 49900, unit_cost: 12000, shipping_cost: 5000,
    image: '/img/semsiye.svg', sort_order: 2,
  },
  {
    slug: 'masaj-aleti',
    name: 'Masaj Aleti',
    headline: 'Günün yorgunluğunu dakikalar içinde atın',
    description: 'Farklı yoğunluk seviyeleriyle boyun, sırt ve bacaklar için rahatlatıcı masaj.',
    features: 'Çok kademeli yoğunluk\nŞarjlı, kablosuz kullanım\nFarklı masaj başlıkları\nSessiz motor',
    price: 59900, compare_price: 89900, unit_cost: 25000, shipping_cost: 6000,
    image: '/img/masaj.svg', sort_order: 3,
  },
];
const SEED_FAQ = 'Kargo ne zaman çıkar? | Siparişler 1-2 iş günü içinde kargoya verilir.\n'
  + 'Kapıda ödeme var mı? | Evet, kapıda nakit veya kartla ödeyebilirsiniz.';

let readyFor = null;

export async function ensureSchema(db) {
  if (readyFor === db) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  const row = await db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).first();
  const version = row ? Number(row.value) : 0;
  for (let v = version; v < MIGRATIONS.length; v++) {
    const stmts = MIGRATIONS[v].map((sql) => db.prepare(sql));
    stmts.push(db.prepare(`INSERT INTO _meta (key, value) VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(String(v + 1)));
    await db.batch(stmts);
  }
  const count = await db.prepare('SELECT COUNT(*) AS n FROM products').first();
  if (count.n === 0) {
    await db.batch(SEED_PRODUCTS.map((p) => db.prepare(`INSERT INTO products
      (slug, name, headline, description, features, faq, price, compare_price, unit_cost, shipping_cost, image, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(p.slug, p.name, p.headline, p.description, p.features,
      SEED_FAQ, p.price, p.compare_price, p.unit_cost, p.shipping_cost, p.image, p.sort_order)));
  }
  readyFor = db;
}

// Sorgu sonuçlarını dizi olarak döndürür.
export async function all(stmt) {
  const r = await stmt.all();
  return r.results || [];
}
