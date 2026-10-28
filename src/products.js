import { STAGES, STAGE_LABELS, MAX_PER_STAGE, MAX_ACTIVE } from './config.js';
import { all } from './db.js';

// Geçmişte izlenen alanlar: değiştiğinde product_history'ye yazılır.
export const TRACKED = ['price', 'compare_price', 'unit_cost', 'shipping_cost', 'stage', 'status', 'name', 'image', 'stock'];

// Yönetim panelinden değiştirilebilen alanlar. Ad, fiyat, görsel ve stok urunler.json dosyasından gelir.
const EDITABLE = ['unit_cost', 'shipping_cost', 'stage'];

const ORDER_BY = `CASE stage WHEN 'kazanan' THEN 0 WHEN 'potansiyel' THEN 1 ELSE 2 END, sort_order, id`;

export function slugify(s) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i' };
  return String(s).toLowerCase()
    .replace(/[çğıöşüİ]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "Özellik 1\nÖzellik 2" -> dizi
export function lines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

// "Soru | Cevap" satırları -> [{q, a}]
export function faqItems(text) {
  return lines(text).map((l) => {
    const i = l.indexOf('|');
    return i === -1 ? { q: l, a: '' } : { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() };
  });
}

const str = (v) => (v === null || v === undefined ? null : String(v));

export function productService(db) {
  const getById = (id) => db.prepare('SELECT * FROM products WHERE id = ?').bind(Number(id) || 0).first();
  const getBySlug = (slug) => db.prepare('SELECT * FROM products WHERE slug = ?').bind(String(slug)).first();

  const listActive = () => all(db.prepare(`SELECT * FROM products WHERE status = 'aktif' ORDER BY ${ORDER_BY}`));
  const listAll = () => all(db.prepare(`SELECT * FROM products ORDER BY status = 'pasif', ${ORDER_BY}`));

  // 3 kazanan + 3 potansiyel + 3 test kuralını kontrol eder.
  async function slotError(stage, status, excludeId) {
    if (status !== 'aktif') return null;
    const same = await db.prepare(`SELECT COUNT(*) AS n FROM products
      WHERE status = 'aktif' AND stage = ? AND id != ?`).bind(stage, excludeId || 0).first();
    if (same.n >= MAX_PER_STAGE) {
      return `"${STAGE_LABELS[stage]}" aşamasında zaten ${MAX_PER_STAGE} aktif ürün var. `
        + 'Önce birini başka aşamaya taşıyın veya pasif yapın.';
    }
    const active = await db.prepare(`SELECT COUNT(*) AS n FROM products WHERE status = 'aktif' AND id != ?`)
      .bind(excludeId || 0).first();
    if (active.n >= MAX_ACTIVE) return `En fazla ${MAX_ACTIVE} aktif ürün olabilir.`;
    return null;
  }

  async function validate(data, existingId) {
    const errors = [];
    if (!data.name) errors.push('Ürün adı gerekli.');
    if (!data.slug) errors.push('Adres (slug) gerekli.');
    if (data.price === null || data.price === undefined) errors.push('Geçerli bir satış fiyatı girin.');
    if (!STAGES.includes(data.stage)) errors.push('Geçersiz aşama.');
    if (!['aktif', 'pasif'].includes(data.status)) errors.push('Geçersiz durum.');
    if (data.slug) {
      const other = await getBySlug(data.slug);
      if (other && other.id !== existingId) errors.push('Bu adres başka bir üründe kullanılıyor.');
    }
    if (STAGES.includes(data.stage)) {
      const slot = await slotError(data.stage, data.status, existingId);
      if (slot) errors.push(slot);
    }
    return errors;
  }

  async function update(id, data) {
    const current = await getById(id);
    if (!current) return { errors: ['Ürün bulunamadı.'] };
    const errors = await validate({ ...current, ...data }, id);
    if (errors.length) return { errors };
    const stmts = [];
    TRACKED.forEach((k) => {
      if (k in data && String(current[k] ?? '') !== String(data[k] ?? '')) {
        stmts.push(db.prepare(`INSERT INTO product_history (product_id, field, old_value, new_value) VALUES (?, ?, ?, ?)`)
          .bind(id, k, str(current[k]), str(data[k])));
      }
    });
    const keys = EDITABLE.filter((k) => k in data);
    if (keys.length) {
      stmts.push(db.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .bind(...keys.map((k) => data[k] ?? null), id));
    }
    if (stmts.length) await db.batch(stmts);
    return { id };
  }

  const history = (id) => all(db.prepare('SELECT * FROM product_history WHERE product_id = ? ORDER BY id DESC').bind(id));

  return { getById, getBySlug, listActive, listAll, update, history, slotError };
}
