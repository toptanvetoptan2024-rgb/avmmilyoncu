const config = require('./config');
const { TZ_OFFSET } = require('./time');

// Ürün bazında performans ve kârlılık raporu.
//
// Hesap:
//   Ciro          = geçerli siparişlerin toplamı (iptal ve iade hariç)
//   Ürün maliyeti = geçerli siparişlerde adet × sipariş anındaki birim maliyet
//   Kargo         = geçerli + iade siparişlerin kargo maliyeti (iade de kargoya çıktı)
//   Brüt kâr      = Ciro − Ürün maliyeti − Kargo
//   Net kâr       = Brüt kâr − Reklam harcaması
//   ROAS          = Ciro / Reklam harcaması
//   Sipariş başı maliyet (CPA) = Reklam harcaması / geçerli sipariş sayısı
// Test siparişleri ve geçersiz sayılan reklam kayıtları hesaba katılmaz.

function productReport(db, { from, to }) {
  const lost = config.lostStatuses.map((s) => `'${s}'`).join(',');
  const dateExpr = `date(o.created_at, '${TZ_OFFSET}')`;
  const rows = db.prepare(`
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
      WHERE view_date BETWEEN @from AND @to GROUP BY product_id
    ) v ON v.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(amount) AS spend, SUM(clicks) AS clicks, SUM(impressions) AS impressions
      FROM ad_spend WHERE voided = 0 AND spend_date BETWEEN @from AND @to GROUP BY product_id
    ) a ON a.product_id = p.id
    LEFT JOIN (
      SELECT o.product_id,
        COUNT(*) AS orders,
        SUM(o.status NOT IN (${lost})) AS valid_orders,
        SUM(o.status IN (${lost})) AS lost_orders,
        SUM(CASE WHEN o.status NOT IN (${lost}) THEN o.quantity ELSE 0 END) AS units,
        SUM(CASE WHEN o.status NOT IN (${lost}) THEN o.total ELSE 0 END) AS revenue,
        SUM(CASE WHEN o.status NOT IN (${lost}) THEN o.unit_cost * o.quantity ELSE 0 END) AS cogs,
        SUM(CASE WHEN o.status != 'iptal' THEN o.shipping_cost ELSE 0 END) AS shipping
      FROM orders o
      WHERE o.is_test = 0 AND ${dateExpr} BETWEEN @from AND @to
      GROUP BY o.product_id
    ) o ON o.product_id = p.id
    ORDER BY p.status = 'pasif', CASE p.stage WHEN 'kazanan' THEN 0 WHEN 'potansiyel' THEN 1 ELSE 2 END, p.sort_order, p.id
  `).all({ from, to });

  const withMetrics = rows.map(addMetrics);
  const total = addMetrics(withMetrics.reduce((acc, r) => {
    ['views', 'spend', 'clicks', 'impressions', 'orders', 'valid_orders', 'lost_orders', 'units', 'revenue', 'cogs', 'shipping']
      .forEach((k) => { acc[k] = (acc[k] || 0) + r[k]; });
    return acc;
  }, { name: 'Toplam' }));
  return { rows: withMetrics, total };
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
    profit_per_order: r.valid_orders > 0 ? Math.round(net / r.valid_orders) : null,
  };
}

// Basit öneri: kâr ve ROAS'a göre ürünün ne yapılması gerektiği.
function suggestion(r) {
  if (r.status === 'pasif') return '';
  if (r.spend === 0 && r.orders === 0) return 'Veri yok';
  if (r.valid_orders === 0 && r.spend > 0) return 'Sipariş yok – değiştirmeyi düşün';
  if (r.net_profit > 0 && r.roas !== null && r.roas >= 2.5) return 'Kârlı – bütçeyi kontrollü artır';
  if (r.net_profit > 0) return 'Kârlı – izlemeye devam';
  return 'Zararda – reklamı/fiyatı gözden geçir';
}

// Günlük seri (tek ürün veya tümü) – trend tablosu için.
function dailySeries(db, { from, to, productId }) {
  const lost = config.lostStatuses.map((s) => `'${s}'`).join(',');
  const pf = productId ? 'AND product_id = @productId' : '';
  const orders = db.prepare(`
    SELECT date(created_at, '${TZ_OFFSET}') AS d, COUNT(*) AS orders,
      SUM(CASE WHEN status NOT IN (${lost}) THEN total ELSE 0 END) AS revenue,
      SUM(CASE WHEN status NOT IN (${lost}) THEN total - unit_cost * quantity - shipping_cost
               WHEN status = 'iade' THEN -shipping_cost ELSE 0 END) AS gross_profit
    FROM orders WHERE is_test = 0 AND date(created_at, '${TZ_OFFSET}') BETWEEN @from AND @to ${pf}
    GROUP BY d`).all({ from, to, productId });
  const spend = db.prepare(`SELECT spend_date AS d, SUM(amount) AS spend FROM ad_spend
    WHERE voided = 0 AND spend_date BETWEEN @from AND @to ${pf} GROUP BY d`).all({ from, to, productId });
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

module.exports = { productReport, dailySeries, suggestion };
