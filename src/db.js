// Cloudflare D1 veritabanı şeması.
//
// Önemli: Bu şemada ürün ve sipariş SİLME yoktur.
// Ürünler "pasif" yapılır, siparişler "iptal"/"iade" durumuna alınır,
// reklam harcamaları "geçersiz" işaretlenir. Böylece performans geçmişi korunur.
//
// Tablolar ilk istekte otomatik oluşturulur; ayrıca bir kurulum komutu gerekmez.
// Ürünler urunler.json dosyasından gelir (bkz. catalog.js).
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
  // 2: Çok ürünlü sepet siparişleri, ayrıntılı adres, tekrar gönderim koruması, stok durumu.
  [
    `ALTER TABLE products ADD COLUMN stock TEXT NOT NULL DEFAULT 'teyit'`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)`,
    // Eski tek ürünlü siparişleri yeni tabloya taşı (eski kayıtlar silinmez).
    `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost)
      SELECT id, product_id, product_name, quantity, unit_price, unit_cost FROM orders`,
    `ALTER TABLE orders ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE orders ADD COLUMN last_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE orders ADD COLUMN email TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE orders ADD COLUMN neighborhood TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE orders ADD COLUMN postal_code TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE orders ADD COLUMN subtotal INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN shipping_fee INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN idempotency_key TEXT NOT NULL DEFAULT ''`,
    `UPDATE orders SET subtotal = total`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key != ''`,
    `CREATE TRIGGER IF NOT EXISTS no_delete_order_items BEFORE DELETE ON order_items
      BEGIN SELECT RAISE(ABORT, 'Sipariş kalemleri silinemez.'); END`,
  ],
];

// Testler için dışa açık.
export { MIGRATIONS };

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
  readyFor = db;
}

// Sorgu sonuçlarını dizi olarak döndürür.
export async function all(stmt) {
  const r = await stmt.all();
  return r.results || [];
}
