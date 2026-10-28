import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { todayTR } from '../time.js';
import { isAdmin } from '../auth.js';
import { MAX_SHOWN } from '../catalog.js';
import { paymentOptions, enabledMethods } from '../payments.js';
import { homePage, infoPage, PAGES } from '../views/shop.js';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless/i;
const MAX_BODY = 20 * 1024;

export const shop = new Hono();

// Reklamdan gelen UTM bilgilerini 30 gün sakla; sipariş hangi reklamdan geldi görülsün.
shop.use('*', async (c, next) => {
  const utm = {};
  UTM_KEYS.forEach((k) => { const v = c.req.query(k); if (v) utm[k] = v.slice(0, 200); });
  if (Object.keys(utm).length) {
    setCookie(c, 'avm_utm', JSON.stringify(utm), { maxAge: 30 * 86400, sameSite: 'Lax', httpOnly: true, path: '/' });
    c.set('utm', utm);
  } else {
    let saved = {};
    try { saved = JSON.parse(getCookie(c, 'avm_utm') || '{}'); } catch { /* yoksay */ }
    c.set('utm', saved && typeof saved === 'object' ? saved : {});
  }
  await next();
});

const shownProducts = async (s) => (await s.products.listActive()).slice(0, MAX_SHOWN);

shop.get('/', async (c) => {
  const s = c.get('s');
  const ctx = c.get('ctx');
  const products = await shownProducts(s);
  const highlight = products.some((p) => p.slug === c.req.query('urun')) ? c.req.query('urun') : '';
  return c.html(homePage(ctx, { products, options: paymentOptions(ctx.store), highlight }).toString());
});

// Reklam linkleri için: /urun/<kod> → ziyareti sayar ve ana sayfada ürünü öne çıkarır.
shop.get('/urun/:slug', async (c) => {
  const s = c.get('s');
  const product = await s.products.getBySlug(c.req.param('slug'));
  if (!product || product.status !== 'aktif') return c.redirect('/', 302);
  const admin = await isAdmin(c, c.get('ctx').rt.sessionSecret);
  if (!admin && !BOT_RE.test(c.req.header('user-agent') || '')) {
    await s.db.prepare(`INSERT INTO product_views (product_id, view_date, views) VALUES (?, ?, 1)
      ON CONFLICT(product_id, view_date) DO UPDATE SET views = views + 1`).bind(product.id, todayTR()).run();
  }
  return c.redirect(`/?urun=${encodeURIComponent(product.slug)}#urun-${product.slug}`, 302);
});

// Basit kötüye kullanım sınırı: aynı IP'den 10 dakikada en fazla 10 sipariş denemesi (her Cloudflare sunucusunda ayrı).
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 10 * 60000);
  h.push(now);
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > 10;
}

shop.post('/api/siparis', async (c) => {
  const s = c.get('s');
  const ctx = c.get('ctx');
  const fail = (status, errors) => c.json({ ok: false, errors }, status);

  // Başka sitelerden gönderilen isteklere izin verme.
  const origin = c.req.header('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* geçersiz */ }
    if (host !== new URL(c.req.url).host) return fail(403, { genel: 'İzin verilmeyen istek.' });
  }
  if (!(c.req.header('content-type') || '').includes('application/json')) return fail(415, { genel: 'Geçersiz istek.' });
  if (Number(c.req.header('content-length') || 0) > MAX_BODY) return fail(413, { genel: 'İstek çok büyük.' });
  // Cloudflare gerçek ortamda her isteğe cf-connecting-ip ekler; yerel denemelerde sınır uygulanmaz.
  const ip = c.req.header('cf-connecting-ip');
  if (ip && rateLimited(ip)) {
    return fail(429, { genel: 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.' });
  }

  let body;
  try {
    const raw = await c.req.text();
    if (raw.length > MAX_BODY) return fail(413, { genel: 'İstek çok büyük.' });
    body = JSON.parse(raw);
  } catch { return fail(400, { genel: 'Geçersiz istek.' }); }
  if (!body || typeof body !== 'object') return fail(400, { genel: 'Geçersiz istek.' });
  if (body.website) return fail(400, { genel: 'Geçersiz istek.' }); // bot tuzağı

  const result = await s.orders.create({ ...body, ...c.get('utm'), referrer: c.req.header('referer') || '' }, {
    products: await shownProducts(s),
    methods: enabledMethods(ctx.store),
    shippingFee: ctx.store.shippingFee,
  });
  if (result.errors) return fail(400, result.errors);

  const o = result.order;
  return c.json({
    ok: true,
    tekrar: result.duplicate,
    siparisNo: o.order_no,
    ozet: {
      urunler: result.items.map((i) => ({ ad: i.product_name, adet: i.quantity, birimFiyat: i.unit_price, tutar: i.quantity * i.unit_price })),
      araToplam: o.subtotal,
      kargo: o.shipping_fee,
      toplam: o.total,
      odeme: o.payment_method,
      teslimat: {
        adSoyad: o.customer_name, telefon: o.phone, il: o.city, ilce: o.district, mahalle: o.neighborhood,
        adres: o.address, postaKodu: o.postal_code,
      },
    },
  }, result.duplicate ? 200 : 201);
});

shop.get('/:page', (c) => {
  const key = c.req.param('page');
  if (!PAGES[key]) return c.notFound();
  return c.html(infoPage(c.get('ctx'), key).toString());
});
