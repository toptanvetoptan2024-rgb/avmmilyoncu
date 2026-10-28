import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_METHODS, PAYMENT_STATUS_LABELS } from './config.js';
import { all } from './db.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newOrderNo() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return 'AVM-' + s;
}

export function cleanPhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  // 05xx xxx xx xx / 5xx xxx xx xx / 905xx xxx xx xx
  const m = digits.match(/^(?:90|0)?(5\d{9})$/);
  return m ? '0' + m[1] : null;
}

const cut = (v, n) => String(v || '').trim().slice(0, n);

export function orderService(db) {
  const addEvent = (id, text) => db.prepare('INSERT INTO order_events (order_id, event) VALUES (?, ?)').bind(id, text);
  const getById = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').bind(Number(id) || 0).first();
  const getByNo = (no) => db.prepare('SELECT * FROM orders WHERE order_no = ?').bind(String(no)).first();

  // input: { product, quantity, customer_name, phone, city, district, address, note, payment_method, utm..., is_test, preErrors }
  async function create(input) {
    const errors = [...(input.preErrors || [])];
    const p = input.product;
    if (!p || p.status !== 'aktif') errors.push('Bu ürün şu an satışta değil.');
    const qty = Number.parseInt(input.quantity, 10);
    if (!(qty >= 1 && qty <= 10)) errors.push('Adet 1 ile 10 arasında olmalı.');
    const name = cut(input.customer_name, 120);
    if (name.length < 3) errors.push('Ad soyad girin.');
    const phone = cleanPhone(input.phone);
    if (!phone) errors.push('Geçerli bir cep telefonu girin (05xx xxx xx xx).');
    const city = cut(input.city, 60);
    if (!city) errors.push('İl girin.');
    const address = cut(input.address, 500);
    if (address.length < 10) errors.push('Açık adresinizi girin.');
    if (!PAYMENT_METHODS[input.payment_method]) errors.push('Ödeme yöntemi seçin.');
    if (errors.length) return { errors };

    const values = [
      p.id, p.name, qty, p.price, p.unit_cost, p.shipping_cost, p.price * qty,
      name, phone, city, cut(input.district, 60), address, cut(input.note, 500),
      input.payment_method, input.is_test ? 1 : 0,
      cut(input.utm_source, 100), cut(input.utm_medium, 100), cut(input.utm_campaign, 200), cut(input.utm_content, 200),
      cut(input.referrer, 300),
    ];
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderNo = newOrderNo();
      try {
        await db.batch([
          db.prepare(`INSERT INTO orders (order_no, product_id, product_name, quantity, unit_price, unit_cost,
            shipping_cost, total, customer_name, phone, city, district, address, note, payment_method, is_test,
            utm_source, utm_medium, utm_campaign, utm_content, referrer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(orderNo, ...values),
          db.prepare(`INSERT INTO order_events (order_id, event) SELECT id, 'Sipariş oluşturuldu' FROM orders WHERE order_no = ?`)
            .bind(orderNo),
        ]);
        return { order: await getByNo(orderNo) };
      } catch (e) {
        if (!String(e.message).includes('UNIQUE')) throw e;
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

  async function addNote(id, text) {
    const t = cut(text, 500);
    if (t) await addEvent(id, 'Not: ' + t).run();
  }

  const events = (id) => all(db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').bind(id));

  function list({ status, productId, includeTest, limit = 200 } = {}) {
    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (productId) { where.push('product_id = ?'); params.push(productId); }
    if (!includeTest) where.push('is_test = 0');
    params.push(limit);
    return all(db.prepare(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY id DESC LIMIT ?`).bind(...params));
  }

  return { create, getByNo, getById, setStatus, setPaymentStatus, setTest, addNote, events, list };
}
