import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { todayTR } from '../time.js';
import { isAdmin } from '../auth.js';
import {
  homePage, productPage, thanksPage, testPaymentPage, infoPage, PAGES,
} from '../views/shop.js';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless/i;

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

shop.get('/', async (c) => {
  const s = c.get('s');
  return c.html(homePage(c.get('ctx'), await s.products.listActive()).toString());
});

async function renderProduct(c, product, form, errors, status = 200) {
  const s = c.get('s');
  const others = (await s.products.listActive()).filter((p) => p.id !== product.id).slice(0, 3);
  const page = productPage(c.get('ctx'), { product, others, methods: s.payments.availableMethods(), form, errors });
  return c.html(page.toString(), status);
}

shop.get('/urun/:slug', async (c) => {
  const s = c.get('s');
  const product = await s.products.getBySlug(c.req.param('slug'));
  if (!product) return c.notFound();
  const admin = await isAdmin(c, c.get('ctx').rt.sessionSecret);
  if (product.status === 'aktif' && !admin && !BOT_RE.test(c.req.header('user-agent') || '')) {
    await s.db.prepare(`INSERT INTO product_views (product_id, view_date, views) VALUES (?, ?, 1)
      ON CONFLICT(product_id, view_date) DO UPDATE SET views = views + 1`).bind(product.id, todayTR()).run();
  }
  // Pasif ürünün sayfası silinmez: eski reklam linkleri diğer ürünlere yönlendirir.
  return renderProduct(c, product, { quantity: 1, payment_method: 'kapida' }, []);
});

shop.post('/siparis', async (c) => {
  const s = c.get('s');
  const body = await c.req.parseBody();
  const product = await s.products.getById(body.product_id);
  if (!product) return c.notFound();
  // Bot tuzağı: gerçek kullanıcı bu alanı görmez.
  if (body.website) return c.redirect(`/urun/${product.slug}`, 303);
  const methods = s.payments.availableMethods();
  const form = { ...body, payment_method: methods[body.payment_method] ? body.payment_method : '' };
  const preErrors = body.onay ? [] : ['Mesafeli satış sözleşmesini onaylayın.'];
  const result = await s.orders.create({
    ...form,
    ...c.get('utm'),
    product,
    preErrors,
    referrer: c.req.header('referer') || '',
    is_test: form.payment_method === 'kart' && s.payments.isTestMode(),
  });
  if (result.errors) return renderProduct(c, product, form, result.errors, 400);
  return c.redirect(s.payments.start(result.order).redirect, 303);
});

shop.get('/siparis/:no', async (c) => {
  const order = await c.get('s').orders.getByNo(c.req.param('no'));
  if (!order) return c.notFound();
  return c.html(thanksPage(c.get('ctx'), order).toString());
});

// TEST ödeme sayfası: yalnızca test modunda çalışır, gerçek para çekilmez.
async function testOrder(c) {
  const s = c.get('s');
  if (!s.payments.isTestMode()) return null;
  const order = await s.orders.getByNo(c.req.param('no'));
  return order && order.payment_method === 'kart' ? order : null;
}

shop.get('/odeme/test/:no', async (c) => {
  const order = await testOrder(c);
  if (!order) return c.notFound();
  return c.html(testPaymentPage(c.get('ctx'), order).toString());
});

shop.post('/odeme/test/:no', async (c) => {
  const s = c.get('s');
  const order = await testOrder(c);
  if (!order || order.payment_status !== 'bekliyor') return c.notFound();
  const ok = (await c.req.parseBody()).sonuc === 'basarili';
  await s.orders.setPaymentStatus(order.id, ok ? 'odendi' : 'basarisiz', ok ? 'TEST ödeme başarılı' : 'TEST ödeme başarısız');
  if (!ok) await s.orders.setStatus(order.id, 'iptal');
  return c.redirect(`/siparis/${order.order_no}`, 303);
});

// Ürün görselleri (Cloudflare KV'de saklanır).
shop.get('/uploads/:key', async (c) => {
  const kv = c.env.IMAGES;
  if (!kv) return c.notFound();
  const { value, metadata } = await kv.getWithMetadata(c.req.param('key'), 'arrayBuffer');
  if (!value) return c.notFound();
  return new Response(value, {
    headers: {
      'Content-Type': metadata?.type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});

shop.get('/:page', (c) => {
  const key = c.req.param('page');
  if (!PAGES[key]) return c.notFound();
  return c.html(infoPage(c.get('ctx'), key).toString());
});
