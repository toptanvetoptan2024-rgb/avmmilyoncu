import { LOST_STATUSES } from './config.js';
import { TZ_OFFSET } from './time.js';
import { all } from './db.js';

// Ürün bazında performans ve kârlılık raporu.
//
// Hesap:
//   Ciro          = geçerli siparişlerin toplamı (iptal ve iade hariç)
//   Ürün maliyeti = geçerli siparişlerde adet × sipariş anındaki birim maliyet
//   Kargo         = geçerli + iade siparişlerin kargo maliyeti (iade de kargoya çıktı)
//   Brüt kâr      = Ciro − Ürün maliyeti − Kargo
//   Net kâr       = Brüt kâr − Reklam harcaması
//   ROAS          = Ciro / Reklam harcaması
//   Sipariş başı reklam maliyeti (CPA) = Reklam harcaması / geçerli sipariş sayısı
// Test siparişleri ve geçersiz sayılan reklam kayıtları hesaba katılmaz.

const LOST = LOST_STATUSES.map((s) => `'${s}'`).join(',');
const SUM_KEYS = ['views', 'spend', 'clicks', 'impressions', 'orders', 'valid_orders', 'lost_orders', 'units', 'revenue', 'cogs', 'shipping'];

export async function productReport(db, { from, to }) {
  const rows = await all(db.prepare(`
    SELECT p.id, p.name, p.slug, p.stage, p.status, p.price,
      COALESCE(v.views, 0) AS views,
      COALESCE(a.spend, 0) AS spend,
      COALESCE(a.clicks, 0) AS clicks,
      COALESCE(a.impressions, 0) AS impressions,
      COALESCE(o.orders, 0) AS orders,
      COALESCE(o.valid_orders, 0) AS valid_orders,
      COALESCE(o.lost_orders, 0) AS lost_orders,
      COALESCE(o.units, 0) AS units,
      COALESCE(o.revenue, 0) AS revenue,
      COALESCE(o.cogs, 0) AS cogs,
      COALESCE(o.shipping, 0) AS shipping
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(views) AS views FROM product_views
      WHERE view_date BETWEEN ? AND ? GROUP BY product_id
    ) v ON v.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(amount) AS spend, SUM(clicks) AS clicks, SUM(impressions) AS impressions
      FROM ad_spend WHERE voided = 0 AND spend_date BETWEEN ? AND ? GROUP BY product_id
    ) a ON a.product_id = p.id
    LEFT JOIN (
      SELECT product_id,
        COUNT(*) AS orders,
        SUM(status NOT IN (${LOST})) AS valid_orders,
        SUM(status IN (${LOST})) AS lost_orders,
        SUM(CASE WHEN status NOT IN (${LOST}) THEN quantity ELSE 0 END) AS units,
        SUM(CASE WHEN status NOT IN (${LOST}) THEN total ELSE 0 END) AS revenue,
        SUM(CASE WHEN status NOT IN (${LOST}) THEN unit_cost * quantity ELSE 0 END) AS cogs,
        SUM(CASE WHEN status != 'iptal' THEN shipping_cost ELSE 0 END) AS shipping
      FROM orders
      WHERE is_test = 0 AND date(created_at, '${TZ_OFFSET}') BETWEEN ? AND ?
      GROUP BY product_id
    ) o ON o.product_id = p.id
    ORDER BY p.status = 'pasif', CASE p.stage WHEN 'kazanan' THEN 0 WHEN 'potansiyel' THEN 1 ELSE 2 END, p.sort_order, p.id
  `).bind(from, to, from, to, from, to));

  const withMetrics = rows.map(addMetrics);
  const totals = { name: 'Toplam' };
  SUM_KEYS.forEach((k) => { totals[k] = withMetrics.reduce((s, r) => s + r[k], 0); });
  return { rows: withMetrics, total: addMetrics(totals) };
}

function addMetrics(r) {
  const gross = r.revenue - r.cogs - r.shipping;
  const net = gross - r.spend;
  return {
    ...r,
    gross_profit: gross,
    net_profit: net,
    roas: r.spend > 0 ? r.revenue / r.spend : null,
    cpa: r.valid_orders > 0 && r.spend > 0 ? Math.round(r.spend / r.valid_orders) : null,
    conversion: r.views > 0 ? r.orders / r.views : null,
  };
}

// Basit öneri: kâr ve ROAS'a göre ürünün ne yapılması gerektiği.
export function suggestion(r) {
  if (r.status === 'pasif') return '';
  if (r.spend === 0 && r.orders === 0) return 'Veri yok';
  if (r.valid_orders === 0 && r.spend > 0) return 'Sipariş yok – değiştirmeyi düşün';
  if (r.net_profit > 0 && r.roas !== null && r.roas >= 2.5) return 'Kârlı – bütçeyi kontrollü artır';
  if (r.net_profit > 0) return 'Kârlı – izlemeye devam';
  return 'Zararda – reklamı/fiyatı gözden geçir';
}

// Günlük seri – trend tablosu için.
export async function dailySeries(db, { from, to }) {
  const orders = await all(db.prepare(`
    SELECT date(created_at, '${TZ_OFFSET}') AS d, COUNT(*) AS orders,
      SUM(CASE WHEN status NOT IN (${LOST}) THEN total ELSE 0 END) AS revenue,
      SUM(CASE WHEN status NOT IN (${LOST}) THEN total - unit_cost * quantity - shipping_cost
               WHEN status = 'iade' THEN -shipping_cost ELSE 0 END) AS gross_profit
    FROM orders WHERE is_test = 0 AND date(created_at, '${TZ_OFFSET}') BETWEEN ? AND ?
    GROUP BY d`).bind(from, to));
  const spend = await all(db.prepare(`SELECT spend_date AS d, SUM(amount) AS spend FROM ad_spend
    WHERE voided = 0 AND spend_date BETWEEN ? AND ? GROUP BY d`).bind(from, to));
  const map = new Map();
  const get = (d) => {
    if (!map.has(d)) map.set(d, { date: d, orders: 0, revenue: 0, gross_profit: 0, spend: 0 });
    return map.get(d);
  };
  orders.forEach((r) => Object.assign(get(r.d), { orders: r.orders, revenue: r.revenue, gross_profit: r.gross_profit }));
  spend.forEach((r) => { get(r.d).spend = r.spend; });
  return [...map.values()]
    .map((r) => ({ ...r, net_profit: r.gross_profit - r.spend }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
