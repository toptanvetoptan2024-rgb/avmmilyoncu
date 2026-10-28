const crypto = require('crypto');
const config = require('./config');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newOrderNo() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return 'AVM-' + s;
}

function cleanPhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  // 05xx xxx xx xx / 5xx xxx xx xx / 905xx xxx xx xx
  const m = digits.match(/^(?:90|0)?(5\d{9})$/);
  return m ? '0' + m[1] : null;
}

function createOrderService(db) {
  const getByNo = db.prepare('SELECT * FROM orders WHERE order_no = ?');
  const addEvent = db.prepare('INSERT INTO order_events (order_id, event) VALUES (?, ?)');

  // input: { product, quantity, customer_name, phone, city, district, address, note, payment_method, utm..., is_test }
  function create(input) {
    const errors = [...(input.preErrors || [])];
    const p = input.product;
    if (!p || p.status !== 'aktif') errors.push('Bu ürün şu an satışta değil.');
    const qty = Number.parseInt(input.quantity, 10);
    if (!(qty >= 1 && qty <= 10)) errors.push('Adet 1 ile 10 arasında olmalı.');
    const name = String(input.customer_name || '').trim();
    if (name.length < 3) errors.push('Ad soyad girin.');
    const phone = cleanPhone(input.phone);
    if (!phone) errors.push('Geçerli bir cep telefonu girin (05xx xxx xx xx).');
    const city = String(input.city || '').trim();
    if (!city) errors.push('İl girin.');
    const address = String(input.address || '').trim();
    if (address.length < 10) errors.push('Açık adresinizi girin.');
    if (!config.paymentMethods[input.payment_method]) errors.push('Ödeme yöntemi seçin.');
    if (errors.length) return { errors };

    const row = {
      product_id: p.id,
      product_name: p.name,
      quantity: qty,
      unit_price: p.price,
      unit_cost: p.unit_cost,
      shipping_cost: p.shipping_cost,
      total: p.price * qty,
      customer_name: name.slice(0, 120),
      phone,
      city: city.slice(0, 60),
      district: String(input.district || '').trim().slice(0, 60),
      address: address.slice(0, 500),
      note: String(input.note || '').trim().slice(0, 500),
      payment_method: input.payment_method,
      is_test: input.is_test ? 1 : 0,
      utm_source: String(input.utm_source || '').slice(0, 100),
      utm_medium: String(input.utm_medium || '').slice(0, 100),
      utm_campaign: String(input.utm_campaign || '').slice(0, 200),
      utm_content: String(input.utm_content || '').slice(0, 200),
      referrer: String(input.referrer || '').slice(0, 300),
    };

    const insert = db.prepare(`INSERT INTO orders (order_no, product_id, product_name, quantity, unit_price,
      unit_cost, shipping_cost, total, customer_name, phone, city, district, address, note, payment_method,
      is_test, utm_source, utm_medium, utm_campaign, utm_content, referrer)
      VALUES (@order_no, @product_id, @product_name, @quantity, @unit_price, @unit_cost, @shipping_cost, @total,
      @customer_name, @phone, @city, @district, @address, @note, @payment_method, @is_test,
      @utm_source, @utm_medium, @utm_campaign, @utm_content, @referrer)`);

    for (let attempt = 0; attempt < 5; attempt++) {
      const order_no = newOrderNo();
      try {
        const id = db.transaction(() => {
          const info = insert.run({ ...row, order_no });
          addEvent.run(info.lastInsertRowid, 'Sipariş oluşturuldu');
          return info.lastInsertRowid;
        })();
        return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(id) };
      } catch (e) {
        if (!String(e.message).includes('UNIQUE')) throw e;
      }
    }
    throw new Error('Sipariş numarası üretilemedi');
  }

  function setStatus(id, status) {
    if (!config.orderStatuses.includes(status)) return false;
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!o || o.status === status) return false;
    db.transaction(() => {
      db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
      addEvent.run(id, `Durum: ${config.orderStatusLabels[o.status]} → ${config.orderStatusLabels[status]}`);
    })();
    return true;
  }

  function setPaymentStatus(id, paymentStatus, note) {
    db.transaction(() => {
      db.prepare(`UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`).run(paymentStatus, id);
      addEvent.run(id, note || `Ödeme durumu: ${paymentStatus}`);
    })();
  }

  function setTest(id, isTest) {
    db.transaction(() => {
      db.prepare(`UPDATE orders SET is_test = ?, updated_at = datetime('now') WHERE id = ?`).run(isTest ? 1 : 0, id);
      addEvent.run(id, isTest ? 'Test siparişi olarak işaretlendi' : 'Test işareti kaldırıldı');
    })();
  }

  function addNote(id, text) {
    const t = String(text || '').trim().slice(0, 500);
    if (t) addEvent.run(id, 'Not: ' + t);
  }

  function events(id) {
    return db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').all(id);
  }

  function list({ status, productId, includeTest, limit = 200 } = {}) {
    const where = [];
    const params = {};
    if (status) { where.push('o.status = @status'); params.status = status; }
    if (productId) { where.push('o.product_id = @productId'); params.productId = productId; }
    if (!includeTest) where.push('o.is_test = 0');
    params.limit = limit;
    return db.prepare(`SELECT o.* FROM orders o ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY o.id DESC LIMIT @limit`).all(params);
  }

  return { create, getByNo: (n) => getByNo.get(n), getById: (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id), setStatus, setPaymentStatus, setTest, addNote, events, list };
}

module.exports = { createOrderService, cleanPhone };
