const config = require('./config');

// Geçmişte izlenen alanlar: değiştiğinde product_history'ye yazılır.
const TRACKED = ['price', 'compare_price', 'unit_cost', 'shipping_cost', 'stage', 'status', 'name', 'image'];

const EDITABLE = ['slug', 'name', 'headline', 'description', 'features', 'faq', 'price',
  'compare_price', 'unit_cost', 'shipping_cost', 'image', 'stage', 'status', 'sort_order'];

function slugify(s) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i' };
  return String(s).toLowerCase()
    .replace(/[çğıöşüİ]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createProductService(db) {
  const getById = db.prepare('SELECT * FROM products WHERE id = ?');
  const getBySlug = db.prepare('SELECT * FROM products WHERE slug = ?');

  function listActive() {
    return db.prepare(`SELECT * FROM products WHERE status = 'aktif'
      ORDER BY CASE stage WHEN 'kazanan' THEN 0 WHEN 'potansiyel' THEN 1 ELSE 2 END, sort_order, id`).all();
  }

  function listAll() {
    return db.prepare(`SELECT * FROM products
      ORDER BY status = 'pasif', CASE stage WHEN 'kazanan' THEN 0 WHEN 'potansiyel' THEN 1 ELSE 2 END, sort_order, id`).all();
  }

  // 3 kazanan + 3 potansiyel + 3 test kuralını kontrol eder.
  function slotError(stage, status, excludeId) {
    if (status !== 'aktif') return null;
    const sameStage = db.prepare(`SELECT COUNT(*) AS n FROM products
      WHERE status = 'aktif' AND stage = ? AND id != ?`).get(stage, excludeId || 0).n;
    if (sameStage >= config.maxPerStage) {
      return `"${config.stageLabels[stage]}" aşamasında zaten ${config.maxPerStage} aktif ürün var. ` +
        'Önce birini başka aşamaya taşıyın veya pasif yapın.';
    }
    const active = db.prepare(`SELECT COUNT(*) AS n FROM products
      WHERE status = 'aktif' AND id != ?`).get(excludeId || 0).n;
    if (active >= config.maxActive) return `En fazla ${config.maxActive} aktif ürün olabilir.`;
    return null;
  }

  function validate(data, existingId) {
    const errors = [];
    if (!data.name) errors.push('Ürün adı gerekli.');
    if (!data.slug) errors.push('Adres (slug) gerekli.');
    if (data.price === null || data.price === undefined) errors.push('Geçerli bir satış fiyatı girin.');
    if (!config.stages.includes(data.stage)) errors.push('Geçersiz aşama.');
    if (!['aktif', 'pasif'].includes(data.status)) errors.push('Geçersiz durum.');
    const other = data.slug && getBySlug.get(data.slug);
    if (other && other.id !== existingId) errors.push('Bu adres başka bir üründe kullanılıyor.');
    const slot = slotError(data.stage, data.status, existingId);
    if (slot) errors.push(slot);
    return errors;
  }

  function create(data) {
    const errors = validate(data, null);
    if (errors.length) return { errors };
    const row = {};
    EDITABLE.forEach((k) => { row[k] = data[k] ?? (k === 'sort_order' ? 0 : ''); });
    row.compare_price = data.compare_price ?? null;
    row.unit_cost = data.unit_cost ?? 0;
    row.shipping_cost = data.shipping_cost ?? 0;
    const cols = EDITABLE.join(', ');
    const vals = EDITABLE.map((k) => '@' + k).join(', ');
    const id = db.transaction(() => {
      const info = db.prepare(`INSERT INTO products (${cols}) VALUES (${vals})`).run(row);
      db.prepare(`INSERT INTO product_history (product_id, field, old_value, new_value)
        VALUES (?, 'olusturuldu', NULL, ?)`).run(info.lastInsertRowid, JSON.stringify({ price: row.price, stage: row.stage }));
      return info.lastInsertRowid;
    })();
    return { id };
  }

  function update(id, data) {
    const current = getById.get(id);
    if (!current) return { errors: ['Ürün bulunamadı.'] };
    const merged = { ...current, ...data };
    const errors = validate(merged, id);
    if (errors.length) return { errors };
    db.transaction(() => {
      const hist = db.prepare(`INSERT INTO product_history (product_id, field, old_value, new_value)
        VALUES (?, ?, ?, ?)`);
      TRACKED.forEach((k) => {
        if (k in data && String(current[k] ?? '') !== String(data[k] ?? '')) {
          hist.run(id, k, current[k] === null ? null : String(current[k]), data[k] === null ? null : String(data[k]));
        }
      });
      const sets = EDITABLE.filter((k) => k in data).map((k) => `${k} = @${k}`);
      if (sets.length) {
        db.prepare(`UPDATE products SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`)
          .run({ ...pick(data, EDITABLE), id });
      }
    })();
    return { id };
  }

  function history(id) {
    return db.prepare('SELECT * FROM product_history WHERE product_id = ? ORDER BY id DESC').all(id);
  }

  return { getById: (id) => getById.get(id), getBySlug: (s) => getBySlug.get(s), listActive, listAll, create, update, history, slotError };
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => { if (k in obj) out[k] = obj[k]; });
  return out;
}

// "Özellik 1\nÖzellik 2" -> dizi
function lines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

// "Soru | Cevap" satırları -> [{q, a}]
function faqItems(text) {
  return lines(text).map((l) => {
    const i = l.indexOf('|');
    return i === -1 ? { q: l, a: '' } : { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() };
  });
}

module.exports = { createProductService, slugify, lines, faqItems, TRACKED };
