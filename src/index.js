// AVM Milyoncu – Cloudflare Workers uygulaması.
// Statik dosyalar (CSS, görseller) "public" klasöründen Cloudflare tarafından doğrudan sunulur.
// Veritabanı: Cloudflare D1 (DB). Ürünler: urunler.json, mağaza ayarları: magaza.json.
import { Hono } from 'hono';
import { runtime } from './config.js';
import { ensureSchema } from './db.js';
import { readStore, syncCatalog } from './catalog.js';
import { productService } from './products.js';
import { orderService } from './orders.js';
import { shop } from './routes/shop.js';
import { admin } from './routes/admin.js';
import { messagePage } from './views/shop.js';

export function createApp() {
  const app = new Hono();

  app.use('*', async (c, next) => {
    const ctx = { rt: runtime(c.env), store: readStore(c.env) };
    c.set('ctx', ctx);
    if (!c.env.DB) {
      return c.html(messagePage(ctx, 'Kurulum eksik', 'Veritabanı (DB) bağlı değil. wrangler.toml ayarlarını kontrol edin.').toString(), 500);
    }
    await ensureSchema(c.env.DB);
    await syncCatalog(c.env.DB);
    c.set('s', {
      db: c.env.DB,
      products: productService(c.env.DB),
      orders: orderService(c.env.DB),
    });
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Frame-Options', 'DENY');
    c.header('Strict-Transport-Security', 'max-age=31536000');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; "
      + "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
  });

  app.route('/yonetim', admin);
  app.route('/', shop);

  app.notFound((c) => {
    const ctx = c.get('ctx') || { rt: runtime(c.env), store: readStore(c.env) };
    return c.html(messagePage(ctx, 'Sayfa bulunamadı', 'Aradığınız sayfa taşınmış veya kaldırılmış olabilir.').toString(), 404);
  });

  app.onError((err, c) => {
    console.error(err);
    const ctx = c.get('ctx') || { rt: runtime(c.env), store: readStore(c.env) };
    return c.html(messagePage(ctx, 'Bir sorun oluştu', 'Lütfen biraz sonra tekrar deneyin.').toString(), 500);
  });

  return app;
}

export default createApp();
