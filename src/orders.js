import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from './config.js';
import { ILLER } from './iller.js';
import { all } from './db.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_QTY = 10;

function newOrderNo() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return 'AVM-' + s;
}

// 05xx xxx xx xx / 5xx xxx xx xx / +90 5xx xxx xx xx -> 05xxxxxxxxx
export function cleanPhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  const m = digits.match(/^(?:90|0)?(5\d{9})$/);
  return m ? '0' + m[1] : null;
}

const text = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const NAME_RE = /^[\p{L}][\p{L}\s.'-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Sunucu tarafı form doğrulaması. Hata mesajları müşteriye gösterilir.
export function validateCustomer(f) {
  const errors = {};
  const v = {
    first_name: text(f.ad, 50),
    last_name: text(f.soyad, 50),
    phone: cleanPhone(f.telefon),
    email: text(f.eposta, 120).toLowerCase(),
    city: text(f.il, 40),
    district: text(f.ilce, 60),
    neighborhood: text(f.mahalle, 80),
    address: String(f.adres ?? '').trim().slice(0, 500),
    postal_code: text(f.postaKodu, 5),
    note: String(f.not ?? '').trim().slice(0, 500),
  };
  if (v.first_name.length < 2 || !NAME_RE.test(v.first_name)) errors.ad = 'Adınızı yazın.';
  if (v.last_name.length < 2 || !NAME_RE.test(v.last_name)) errors.soyad = 'Soyadınızı yazın.';
  if (!v.phone) errors.telefon = 'Geçerli bir cep telefonu numarası yazın (örnek: 0532 123 45 67).';
  if (v.email && !EMAIL_RE.test(v.email)) errors.eposta = 'E-posta adresi geçersiz görünüyor.';
  if (!ILLER.includes(v.city)) errors.il = 'İl seçin.';
  if (v.district.length < 2) errors.ilce = 'İlçe yazın.';
  if (v.neighborhood.length < 2) errors.mahalle = 'Mahalle yazın.';
  if (v.address.length < 10) errors.adres = 'Sokak, bina ve daire numarasıyla açık adresinizi yazın.';
  if (v.postal_code && !/^\d{5}$/.test(v.postal_code)) errors.postaKodu = 'Posta kodu 5 rakam olmalı.';
  if (!f.onay) errors.onay = 'Devam etmek için mesafeli satış sözleşmesini onaylayın.';
  return { values: v, errors };
}

export function orderService(db) {
  const addEvent = (id, msg) => db.prepare('INSERT INTO order_events (order_id, event) VALUES (?, ?)').bind(id, msg);
  const getById = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').bind(Number(id) || 0).first();
  const getByNo = (no) => db.prepare('SELECT * FROM orders WHERE order_no = ?').bind(String(no)).first();
  const getByKey = (key) => db.prepare(`SELECT * FROM orders WHERE idempotency_key = ? AND idempotency_key != ''`).bind(key).first();
  const items = (orderId) => all(db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(orderId));

  // input: { sepet: [{kod, adet}], müşteri alanları, odemeYontemi, anahtar, utm..., referrer }
  // ctx: { products (aktif ürünler, DB satırları), methods (kullanılabilir ödeme yöntemleri), shippingFee }
  async function create(input, ctx) {
    const errors = {};
    const key = String(input.anahtar || '');
    if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) errors.genel = 'Sayfayı yenileyip tekrar deneyin.';

    // Aynı anahtarla daha önce kaydedilmiş sipariş varsa onu döndür (çift kayıt olmaz).
    if (!errors.genel) {
      const prev = await getByKey(key);
      if (prev) return { order: prev, items: await items(prev.id), duplicate: true };
    }

    // Sepet: fiyatlar her zaman sunucudaki ürün bilgisinden alınır, tarayıcıdan gelen fiyata güvenilmez.
    const bySlug = new Map(ctx.products.map((p) => [p.slug, p]));
    const merged = new Map();
    (Array.isArray(input.sepet) ? input.sepet : []).slice(0, 20).forEach((it) => {
      const slug = String(it?.kod || '');
      const qty = Number(it?.adet);
      if (!Number.isInteger(qty) || qty < 1) return;
      merged.set(slug, (merged.get(slug) || 0) + qty);
    });
    const lines = [];
    for (const [slug, qty] of merged) {
      const p = bySlug.get(slug);
      if (!p) { errors.sepet = 'Sepetinizdeki bir ürün artık satışta değil. Sepetinizi kontrol edin.'; continue; }
      if (p.stock === 'tukendi') { errors.sepet = `${p.name} tükendi. Sepetinizden çıkarın.`; continue; }
      if (qty > MAX_QTY) { errors.sepet = `Bir üründen en fazla ${MAX_QTY} adet sipariş verilebilir.`; continue; }
      lines.push({ p, qty });
    }
    if (!lines.length && !errors.sepet) errors.sepet = 'Sepetiniz boş. Sipariş vermek için ürün ekleyin.';

    const { values: c, errors: formErrors } = validateCustomer(input);
    Object.assign(errors, formErrors);
    let method = String(input.odemeYontemi || '');
    let isTest = 0;
    if (!ctx.methods.includes(method)) {
      errors.odeme = ctx.methods.length ? 'Ödeme yöntemi seçin.' : 'Şu anda online sipariş alınmıyor.';
    }
    if (Object.keys(errors).length) return { errors };
    // Yönetici test siparişi: kapıda ödeme gibi kaydedilir ama test olarak işaretlenir.
    if (method === 'test') { method = 'kapida'; isTest = 1; }

    const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const shippingCost = Math.max(...lines.map((l) => l.p.shipping_cost || 0));
    const shippingFee = ctx.shippingFee || 0;
    const summary = lines.map((l) => `${l.p.name} ×${l.qty}`).join(', ').slice(0, 300);
    const units = lines.reduce((s, l) => s + l.qty, 0);

    for (let attempt = 0; attempt < 5; attempt++) {
      const orderNo = newOrderNo();
      const orderId = `(SELECT id FROM orders WHERE order_no = '${orderNo}')`; // orderNo yalnızca güvenli harflerden oluşur
      try {
        await db.batch([
          db.prepare(`INSERT INTO orders (order_no, product_id, product_name, quantity, unit_price, unit_cost, shipping_cost,
            subtotal, shipping_fee, total, customer_name, first_name, last_name, phone, email, city, district, neighborhood,
            address, postal_code, note, payment_method, is_test, utm_source, utm_medium, utm_campaign, utm_content, referrer,
            idempotency_key)
            VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            orderNo, lines[0].p.id, summary, units, shippingCost, subtotal, shippingFee, subtotal + shippingFee,
            `${c.first_name} ${c.last_name}`, c.first_name, c.last_name, c.phone, c.email, c.city, c.district,
            c.neighborhood, c.address, c.postal_code, c.note, method, isTest,
            text(input.utm_source, 100), text(input.utm_medium, 100), text(input.utm_campaign, 200), text(input.utm_content, 200),
            text(input.referrer, 300), key,
          ),
          ...lines.map((l) => db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost)
            VALUES (${orderId}, ?, ?, ?, ?, ?)`).bind(l.p.id, l.p.name, l.qty, l.p.price, l.p.unit_cost || 0)),
          db.prepare(`INSERT INTO order_events (order_id, event) VALUES (${orderId}, ?)`)
            .bind(isTest ? 'Yönetici test siparişi oluşturuldu' : 'Sipariş oluşturuldu'),
        ]);
        const order = await getByNo(orderNo);
        return { order, items: await items(order.id), duplicate: false };
      } catch (e) {
        if (!String(e.message).includes('UNIQUE')) throw e;
        // Aynı anda iki kez gönderildiyse ilk kaydı döndür.
        const prev = await getByKey(key);
        if (prev) return { order: prev, items: await items(prev.id), duplicate: true };
      }
    }
    throw new Error('Sipariş numarası üretilemedi');
  }

  async function setStatus(id, status) {
    if (!ORDER_STATUSES.includes(status)) return false;
    const o = await getById(id);
    if (!o || o.status === status) return false;
    await db.batch([
      db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, id),
      addEvent(id, `Durum: ${ORDER_STATUS_LABELS[o.status]} → ${ORDER_STATUS_LABELS[status]}`),
    ]);
    return true;
  }

  async function setPaymentStatus(id, paymentStatus, note) {
    if (!PAYMENT_STATUS_LABELS[paymentStatus]) return;
    await db.batch([
      db.prepare(`UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`).bind(paymentStatus, id),
      addEvent(id, note || `Ödeme durumu: ${PAYMENT_STATUS_LABELS[paymentStatus]}`),
    ]);
  }

  async function setTest(id, isTest) {
    await db.batch([
      db.prepare(`UPDATE orders SET is_test = ?, updated_at = datetime('now') WHERE id = ?`).bind(isTest ? 1 : 0, id),
      addEvent(id, isTest ? 'Test siparişi olarak işaretlendi' : 'Test işareti kaldırıldı'),
    ]);
  }

  async function addNote(id, msg) {
    const t = String(msg || '').trim().slice(0, 500);
    if (t) await addEvent(id, 'Not: ' + t).run();
  }

  const events = (id) => all(db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').bind(id));

  function list({ status, productId, includeTest, limit = 200 } = {}) {
    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (productId) { where.push('id IN (SELECT order_id FROM order_items WHERE product_id = ?)'); params.push(productId); }
    if (!includeTest) where.push('is_test = 0');
    params.push(limit);
    return all(db.prepare(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY id DESC LIMIT ?`).bind(...params));
  }

  return { create, getByNo, getById, items, setStatus, setPaymentStatus, setTest, addNote, events, list };
}
