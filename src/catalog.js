// Ürün kataloğu (urunler.json) ve mağaza ayarları (magaza.json).
// Bu iki dosya kod yazmadan düzenlenebilir; değişiklikler GitHub'a gönderilince siteye yansır.
import urunlerDosyasi from '../urunler.json' with { type: 'json' };
import magazaDosyasi from '../magaza.json' with { type: 'json' };
import { all } from './db.js';

export const MAX_SHOWN = 3; // Sitede gösterilen en fazla ürün sayısı
export const STOCK_LABELS = {
  stokta: 'Stokta',
  sinirli: 'Sınırlı stok',
  tukendi: 'Tükendi',
  teyit: 'Stok sipariş sonrası teyit edilir',
};

const toKurus = (tl) => (tl === null || tl === undefined || tl === '' ? null : Math.round(Number(tl) * 100));

// urunler.json girişlerini doğrular; hatalı girişleri atlar (sebebiyle birlikte).
export function readCatalog(source = urunlerDosyasi) {
  const products = [];
  const problems = [];
  const seen = new Set();
  (source.urunler || []).forEach((u, i) => {
    const where = `urunler.json ${i + 1}. ürün`;
    const kod = String(u.kod || '').trim();
    const price = toKurus(u.fiyat);
    const compare = toKurus(u.eskiFiyat);
    if (!/^[a-z0-9-]{2,60}$/.test(kod)) return problems.push(`${where}: "kod" yalnızca küçük harf, rakam ve tire içermeli.`);
    if (seen.has(kod)) return problems.push(`${where}: "${kod}" kodu iki kez kullanılmış.`);
    if (!String(u.ad || '').trim()) return problems.push(`${where}: "ad" boş olamaz.`);
    if (!(price > 0)) return problems.push(`${where}: "fiyat" 0'dan büyük bir sayı olmalı.`);
    if (compare !== null && !(compare > 0)) return problems.push(`${where}: "eskiFiyat" sayı ya da null olmalı.`);
    const stock = STOCK_LABELS[u.stok] ? u.stok : 'teyit';
    seen.add(kod);
    products.push({
      slug: kod,
      name: String(u.ad).trim().slice(0, 120),
      headline: String(u.kisaAciklama || '').trim().slice(0, 200),
      price,
      compare_price: compare !== null && compare > price ? compare : null,
      image: String(u.gorsel || '').trim(),
      stock,
      status: u.aktif === false ? 'pasif' : 'aktif',
      sort_order: i + 1,
    });
  });
  return { products, problems };
}

// Mağaza ayarları. Cloudflare ortam değişkenleri dosyadaki değerleri ezebilir.
export function readStore(env = {}, source = magazaDosyasi) {
  const s = source || {};
  const onOff = (v, fallback) => (v === 'acik' ? true : v === 'kapali' ? false : fallback);
  const fee = Math.max(0, toKurus(s.kargo?.musteriKargoUcreti) || 0);
  return {
    contact: {
      phone: env.CONTACT_PHONE || s.iletisim?.telefon || '',
      email: env.CONTACT_EMAIL || s.iletisim?.eposta || '',
      whatsapp: (env.CONTACT_WHATSAPP || s.iletisim?.whatsapp || '').replace(/\D/g, ''),
    },
    cashOnDelivery: onOff(env.KAPIDA_ODEME, s.odeme?.kapidaOdeme === true),
    cashOnDeliveryText: s.odeme?.kapidaOdemeAciklama || 'Kapıda ödeme',
    shippingFee: fee,
    deliveryText: s.kargo?.teslimSuresi || '',
  };
}

const TRACKED = ['name', 'headline', 'price', 'compare_price', 'image', 'stock', 'status'];
let syncedFor = null;

// Katalog dosyasını veritabanına işler. Ürün silinmez: dosyadan çıkarılan ürün "pasif" olur.
// Tüm değişiklikler product_history tablosuna yazılır (performans geçmişi korunur).
export async function syncCatalog(db, catalog = readCatalog()) {
  if (syncedFor === db) return;
  catalog.problems.forEach((p) => console.warn('Katalog uyarısı:', p));
  const existing = await all(db.prepare('SELECT * FROM products'));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  const stmts = [];
  const hist = (slug, field, oldV, newV) => db.prepare(`INSERT INTO product_history (product_id, field, old_value, new_value)
    SELECT id, ?, ?, ? FROM products WHERE slug = ?`).bind(field, oldV === null ? null : String(oldV), newV === null ? null : String(newV), slug);

  for (const p of catalog.products) {
    const cur = bySlug.get(p.slug);
    if (!cur) {
      stmts.push(db.prepare(`INSERT INTO products (slug, name, headline, price, compare_price, image, stock, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(p.slug, p.name, p.headline, p.price, p.compare_price, p.image, p.stock, p.status, p.sort_order));
      stmts.push(hist(p.slug, 'olusturuldu', null, JSON.stringify({ price: p.price, kaynak: 'urunler.json' })));
      continue;
    }
    const changed = TRACKED.filter((k) => String(cur[k] ?? '') !== String(p[k] ?? ''));
    changed.forEach((k) => { if (k !== 'headline') stmts.push(hist(p.slug, k, cur[k], p[k])); });
    if (changed.length || cur.sort_order !== p.sort_order) {
      stmts.push(db.prepare(`UPDATE products SET name = ?, headline = ?, price = ?, compare_price = ?, image = ?, stock = ?,
        status = ?, sort_order = ?, updated_at = datetime('now') WHERE slug = ?`)
        .bind(p.name, p.headline, p.price, p.compare_price, p.image, p.stock, p.status, p.sort_order, p.slug));
    }
  }
  const inFile = new Set(catalog.products.map((p) => p.slug));
  existing.filter((p) => !inFile.has(p.slug) && p.status === 'aktif').forEach((p) => {
    stmts.push(db.prepare(`UPDATE products SET status = 'pasif', updated_at = datetime('now') WHERE id = ?`).bind(p.id));
    stmts.push(hist(p.slug, 'status', 'aktif', 'pasif'));
  });
  if (stmts.length) await db.batch(stmts);
  syncedFor = db;
}
