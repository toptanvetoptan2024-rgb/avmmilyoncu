// Canlıdaki eski veritabanı (sürüm 1) yeni sürüme sorunsuz geçmeli; eski siparişler korunmalı.
import test from 'node:test';
import assert from 'node:assert';
import { MIGRATIONS, ensureSchema } from '../src/db.js';
import { syncCatalog } from '../src/catalog.js';
import { createD1 } from './d1-shim.js';

test('eski veritabanı güncellenir, eski sipariş ve ürünler korunur', async () => {
  const DB = createD1();
  const sql = DB.raw;
  // Eski sürümü kur (sürüm 1) ve eski tarzda veri ekle
  sql.exec('CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  MIGRATIONS[0].forEach((s) => sql.exec(s));
  sql.exec(`INSERT INTO _meta VALUES ('schema_version', '1')`);
  sql.exec(`INSERT INTO products (slug, name, price, unit_cost, shipping_cost) VALUES
    ('elektrikli-isitici', 'Elektrikli Isıtıcı', 89900, 42000, 6000),
    ('semsiye', 'Şemsiye', 34900, 12000, 5000),
    ('masaj-aleti', 'Masaj Aleti', 59900, 25000, 6000)`);
  sql.exec(`INSERT INTO orders (order_no, product_id, product_name, quantity, unit_price, unit_cost, shipping_cost, total,
    customer_name, phone, city, address, payment_method) VALUES
    ('AVM-ESKI0001', 2, 'Şemsiye', 2, 34900, 12000, 5000, 69800, 'Eski Müşteri', '05320000000', 'Ankara', 'Eski adres 12345', 'kapida')`);

  await ensureSchema(DB);
  await syncCatalog(DB);

  assert.strictEqual(sql.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get().value, String(MIGRATIONS.length));
  const old = sql.prepare(`SELECT * FROM orders WHERE order_no = 'AVM-ESKI0001'`).get();
  assert.strictEqual(old.subtotal, 69800);
  const items = sql.prepare('SELECT * FROM order_items WHERE order_id = ?').all(old.id);
  assert.deepStrictEqual(items.map((i) => [i.product_name, i.quantity, i.unit_price, i.unit_cost]), [['Şemsiye', 2, 34900, 12000]]);

  // Eski ürünler silinmez, pasif olur; yeni 3 ürün eklenir
  const products = sql.prepare('SELECT slug, status FROM products ORDER BY id').all();
  assert.deepStrictEqual(products.map((p) => [p.slug, p.status]), [
    ['elektrikli-isitici', 'pasif'], ['semsiye', 'pasif'], ['masaj-aleti', 'pasif'],
    ['semsiye-tipi-isitici', 'aktif'], ['masaj-tabancasi', 'aktif'], ['kablosuz-kulaklik', 'aktif'],
  ]);
  assert.strictEqual(sql.prepare(`SELECT COUNT(*) n FROM product_history WHERE field = 'status' AND new_value = 'pasif'`).get().n, 3);
});

test('katalogda fiyat değişince geçmişe yazılır', async () => {
  const DB = createD1();
  await ensureSchema(DB);
  await syncCatalog(DB, { problems: [], products: [{ slug: 'urun-a', name: 'A', headline: '', price: 1000, compare_price: null, image: '', stock: 'teyit', status: 'aktif', sort_order: 1 }] });
  const DB2 = { ...DB }; // aynı veritabanı, yeni yayın gibi
  await syncCatalog(DB2, { problems: [], products: [{ slug: 'urun-a', name: 'A', headline: '', price: 1500, compare_price: null, image: '', stock: 'stokta', status: 'aktif', sort_order: 1 }] });
  const h = DB.raw.prepare(`SELECT field, old_value, new_value FROM product_history WHERE field IN ('price', 'stock') ORDER BY id`).all();
  assert.deepStrictEqual(h.map((x) => [x.field, x.old_value, x.new_value]), [['price', '1000', '1500'], ['stock', 'teyit', 'stokta']]);
});
