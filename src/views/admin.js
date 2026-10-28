import { html } from '../html.js';
import { formatTRY, toInput } from '../money.js';
import { formatDateTime } from '../time.js';
import {
  STAGES, STAGE_LABELS, MAX_PER_STAGE, ORDER_STATUSES, ORDER_STATUS_LABELS, AD_CHANNELS, AD_CHANNEL_LABELS,
  PAYMENT_METHODS, PAYMENT_STATUS_LABELS,
} from '../config.js';

const errorBox = (errors) => (errors && errors.length
  ? html`<div class="alert"><ul>${errors.map((e) => html`<li>${e}</li>`)}</ul></div>` : '');
const sel = (a, b) => (String(a) === String(b) ? 'selected' : '');

export function adminLayout(ctx, { title, path, hideNav }, body) {
  const on = (p) => (p === '/' ? path === '/' : path.startsWith(p)) ? 'on' : '';
  return html`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} · Yönetim</title>
  <link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body class="admin">
<header class="site-header">
  <div class="wrap header-inner">
    <a href="/yonetim" class="logo"><span class="logo-mark">AVM</span><span class="logo-text">Yönetim</span></a>
    ${hideNav ? '' : html`<form method="post" action="/yonetim/cikis"><button class="link-btn">Çıkış</button></form>`}
  </div>
  ${hideNav ? '' : html`<nav class="admin-nav wrap">
    <a href="/yonetim" class="${on('/')}">Panel</a>
    <a href="/yonetim/urunler" class="${on('/urunler')}">Ürünler</a>
    <a href="/yonetim/siparisler" class="${on('/siparisler')}">Siparişler</a>
    <a href="/yonetim/reklam" class="${on('/reklam')}">Reklam</a>
    <a href="/" target="_blank">Siteyi gör ↗</a>
  </nav>`}
</header>
${ctx.testMode ? html`<div class="test-bar">TEST MODU – kart ödemeleri simülasyon. Canlı ödeme için PAYMENT_MODE=live ve gerçek sağlayıcı gerekir.</div>` : ''}
<main class="wrap section">
${body}
</main>
</body>
</html>`;
}

export function loginPage(ctx, error, notConfigured) {
  return adminLayout(ctx, { title: 'Yönetim girişi', path: '', hideNav: true }, html`
<div class="narrow">
  <h1>Yönetim girişi</h1>
  ${notConfigured ? html`<div class="alert">Yönetim şifresi henüz ayarlanmamış. Cloudflare panelinde bu Worker'ın
    <strong>Ayarlar → Değişkenler ve Gizli Değerler</strong> bölümüne <strong>ADMIN_PASSWORD</strong> adında bir gizli değer (Secret) ekleyin.</div>` : ''}
  ${error ? html`<div class="alert">${error}</div>` : ''}
  <form method="post" class="form">
    <label>Şifre <input type="password" name="password" autocomplete="current-password" autofocus required></label>
    <button class="btn btn-block">Giriş yap</button>
  </form>
</div>`);
}

const pct = (x) => (x === null ? '–' : '%' + (x * 100).toFixed(1).replace('.', ','));
const num = (x, d) => (x === null ? '–' : x.toFixed(d).replace('.', ','));
const money = (x) => (x === null ? '–' : formatTRY(x));
const cls = (x) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');

export function dashboardPage(ctx, { range, report, suggestion, slots, daily, newOrders }) {
  const presets = [['bugun', 'Bugün'], ['7', '7 gün'], ['30', '30 gün'], ['90', '90 gün'], ['tumu', 'Tümü']];
  const t = report.total;
  return adminLayout(ctx, { title: 'Panel', path: '/' }, html`
<div class="page-head">
  <h1>Panel</h1>
  ${newOrders ? html`<a class="btn btn-sm" href="/yonetim/siparisler?durum=yeni">${newOrders} yeni sipariş</a>` : ''}
</div>
<form class="filters" method="get">
  ${presets.map(([k, l]) => html`<a class="chip ${range.preset === k ? 'on' : ''}" href="?aralik=${k}">${l}</a>`)}
  <span class="inline">
    <input type="date" name="baslangic" value="${range.from === '2000-01-01' ? '' : range.from}">
    <input type="date" name="bitis" value="${range.to}">
    <button class="btn btn-sm btn-dark">Uygula</button>
  </span>
</form>
<div class="kpis">
  <div class="kpi"><span>Reklam harcaması</span><strong>${formatTRY(t.spend)}</strong></div>
  <div class="kpi"><span>Ciro</span><strong>${formatTRY(t.revenue)}</strong></div>
  <div class="kpi"><span>Geçerli sipariş</span><strong>${t.valid_orders}</strong></div>
  <div class="kpi"><span>ROAS</span><strong>${num(t.roas, 2)}</strong></div>
  <div class="kpi"><span>Net kâr</span><strong class="${cls(t.net_profit)}">${formatTRY(t.net_profit)}</strong></div>
</div>

<h2>Ürün performansı</h2>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Ürün</th><th>Aşama</th><th>Ziyaret</th><th>Reklam</th><th>Sipariş</th><th>İptal/İade</th>
    <th>Dönüşüm</th><th>Ciro</th><th>Maliyet+Kargo</th><th>Sipariş başı rek.</th><th>ROAS</th><th>Net kâr</th><th>Öneri</th></tr></thead>
  <tbody>
  ${report.rows.filter((r) => r.status === 'aktif' || r.orders || r.spend).map((r) => html`
    <tr class="${r.status === 'pasif' ? 'dim' : ''}">
      <td><a href="/yonetim/urunler/${r.id}">${r.name}</a></td>
      <td><span class="tag tag-${r.status === 'pasif' ? 'pasif' : r.stage}">${r.status === 'pasif' ? 'Pasif' : STAGE_LABELS[r.stage]}</span></td>
      <td>${r.views}</td><td>${formatTRY(r.spend)}</td><td>${r.valid_orders}</td><td>${r.lost_orders}</td>
      <td>${pct(r.conversion)}</td><td>${formatTRY(r.revenue)}</td><td>${formatTRY(r.cogs + r.shipping)}</td>
      <td>${money(r.cpa)}</td><td>${num(r.roas, 2)}</td>
      <td class="${cls(r.net_profit)}"><strong>${formatTRY(r.net_profit)}</strong></td>
      <td class="small">${suggestion(r)}</td>
    </tr>`)}
  </tbody>
</table></div>
<p class="muted small">Net kâr = Ciro − ürün maliyeti − kargo − reklam. İptal ve iadeler ciroya girmez; iadelerin kargo maliyeti düşülür. Test siparişleri sayılmaz.</p>

<h2>Ürün yuvaları</h2>
<div class="slots">
  ${STAGES.map((s) => html`<div class="slot-col">
    <h3>${STAGE_LABELS[s]} <span class="muted">(${slots[s].length}/${MAX_PER_STAGE})</span></h3>
    ${slots[s].map((p) => html`<a class="slot" href="/yonetim/urunler/${p.id}">${p.name}</a>`)}
    ${Array.from({ length: Math.max(0, MAX_PER_STAGE - slots[s].length) }, () => html`<a class="slot empty" href="/yonetim/urunler/yeni">+ Boş yuva</a>`)}
  </div>`)}
</div>

<h2>Günlük</h2>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Tarih</th><th>Reklam</th><th>Sipariş</th><th>Ciro</th><th>Net kâr</th></tr></thead>
  <tbody>
  ${daily.length ? '' : html`<tr><td colspan="5" class="muted">Bu aralıkta veri yok.</td></tr>`}
  ${daily.map((d) => html`<tr><td>${d.date}</td><td>${formatTRY(d.spend)}</td><td>${d.orders}</td><td>${formatTRY(d.revenue)}</td>
    <td class="${cls(d.net_profit)}">${formatTRY(d.net_profit)}</td></tr>`)}
  </tbody>
</table></div>`);
}

export function productsPage(ctx, products) {
  return adminLayout(ctx, { title: 'Ürünler', path: '/urunler' }, html`
<div class="page-head">
  <h1>Ürünler</h1>
  <a class="btn btn-sm" href="/yonetim/urunler/yeni">+ Yeni ürün</a>
</div>
<p class="muted small">Ürünler silinmez. Satıştan kaldırmak için ürünü açıp durumunu "Pasif" yapın; geçmişi ve siparişleri korunur.</p>
<div class="table-wrap"><table class="table">
  <thead><tr><th></th><th>Ürün</th><th>Aşama</th><th>Durum</th><th>Fiyat</th><th>Maliyet</th><th>Kargo</th><th>Birim brüt kâr</th></tr></thead>
  <tbody>
  ${products.map((p) => html`<tr class="${p.status === 'pasif' ? 'dim' : ''}">
    <td><img class="thumb" src="${p.image || '/img/placeholder.svg'}" alt=""></td>
    <td><a href="/yonetim/urunler/${p.id}">${p.name}</a><br><span class="muted small">/urun/${p.slug}</span></td>
    <td><span class="tag tag-${p.stage}">${STAGE_LABELS[p.stage]}</span></td>
    <td><span class="tag tag-${p.status}">${p.status === 'aktif' ? 'Aktif' : 'Pasif'}</span></td>
    <td>${formatTRY(p.price)}</td><td>${formatTRY(p.unit_cost)}</td><td>${formatTRY(p.shipping_cost)}</td>
    <td>${formatTRY(p.price - p.unit_cost - p.shipping_cost)}</td>
  </tr>`)}
  </tbody>
</table></div>`);
}

const FIELD_LABELS = {
  price: 'Fiyat', compare_price: 'Eski fiyat', unit_cost: 'Maliyet', shipping_cost: 'Kargo maliyeti',
  stage: 'Aşama', status: 'Durum', name: 'Ad', image: 'Görsel', olusturuldu: 'Oluşturuldu',
};
const MONEY_FIELDS = ['price', 'compare_price', 'unit_cost', 'shipping_cost'];
function showVal(f, v) {
  if (v === null || v === '') return '–';
  if (MONEY_FIELDS.includes(f)) return formatTRY(Number(v));
  if (f === 'stage') return STAGE_LABELS[v] || v;
  return v;
}

export function productFormPage(ctx, { product, history, errors, saved }) {
  const p = product;
  return adminLayout(ctx, { title: p.id ? p.name : 'Yeni ürün', path: '/urunler' }, html`
<div class="page-head">
  <h1>${p.id ? p.name : 'Yeni ürün'}</h1>
  ${p.id ? html`<a class="btn btn-sm btn-dark" href="/urun/${p.slug}" target="_blank">Sayfayı gör ↗</a>` : ''}
</div>
${saved ? html`<div class="ok">Kaydedildi.</div>` : ''}
${errorBox(errors)}
<form method="post" action="/yonetim/urunler${p.id ? '/' + p.id : ''}" enctype="multipart/form-data" class="form form-wide">
  <fieldset>
    <legend>Satış ayarları</legend>
    <div class="row-2">
      <label>Aşama
        <select name="stage">${STAGES.map((s) => html`<option value="${s}" ${sel(p.stage, s)}>${STAGE_LABELS[s]}</option>`)}</select>
      </label>
      <label>Durum
        <select name="status">
          <option value="aktif" ${sel(p.status, 'aktif')}>Aktif (satışta)</option>
          <option value="pasif" ${sel(p.status, 'pasif')}>Pasif (satıştan kaldırıldı)</option>
        </select>
      </label>
    </div>
    <div class="row-2">
      <label>Satış fiyatı (₺) <input name="price" inputmode="decimal" required value="${toInput(p.price)}" placeholder="899,90"></label>
      <label>Eski fiyat (₺, üstü çizili) <input name="compare_price" inputmode="decimal" value="${toInput(p.compare_price)}"></label>
    </div>
    <div class="row-2">
      <label>Ürün maliyeti (₺, adet başı) <input name="unit_cost" inputmode="decimal" value="${toInput(p.unit_cost)}"></label>
      <label>Kargo maliyeti (₺, sipariş başı) <input name="shipping_cost" inputmode="decimal" value="${toInput(p.shipping_cost)}"></label>
    </div>
  </fieldset>
  <fieldset>
    <legend>Sayfa içeriği</legend>
    <label>Ürün adı <input name="name" required value="${p.name}"></label>
    <label>Sayfa adresi <span class="muted small">(boş bırakılırsa addan üretilir)</span>
      <input name="slug" value="${p.slug}" placeholder="ornek-urun"></label>
    <label>Başlık / slogan <input name="headline" value="${p.headline}"></label>
    <label>Açıklama <textarea name="description" rows="4">${p.description}</textarea></label>
    <label>Öne çıkan özellikler <span class="muted small">(her satıra bir tane)</span>
      <textarea name="features" rows="4">${p.features}</textarea></label>
    <label>Sıkça sorulan sorular <span class="muted small">(her satır: Soru | Cevap)</span>
      <textarea name="faq" rows="4">${p.faq}</textarea></label>
    <label>Sıra <input name="sort_order" type="number" value="${p.sort_order}"></label>
  </fieldset>
  <fieldset>
    <legend>Görsel</legend>
    ${p.image ? html`<img class="preview" src="${p.image}" alt="">` : ''}
    <label>Yeni görsel yükle (JPG, PNG, WEBP – en fazla 3 MB) <input type="file" name="image_file" accept="image/jpeg,image/png,image/webp"></label>
    <label>veya görsel adresi <input name="image_url" value="${p.image}"></label>
  </fieldset>
  <button class="btn btn-lg">Kaydet</button>
</form>
${history.length ? html`<h2>Değişiklik geçmişi</h2>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Tarih</th><th>Alan</th><th>Eski</th><th>Yeni</th></tr></thead>
  <tbody>${history.map((h) => html`<tr><td>${formatDateTime(h.changed_at)}</td><td>${FIELD_LABELS[h.field] || h.field}</td>
    <td>${h.field === 'olusturuldu' ? '' : showVal(h.field, h.old_value)}</td>
    <td>${h.field === 'olusturuldu' ? '' : showVal(h.field, h.new_value)}</td></tr>`)}</tbody>
</table></div>` : ''}`);
}

export function ordersPage(ctx, { orders, filter, products }) {
  return adminLayout(ctx, { title: 'Siparişler', path: '/siparisler' }, html`
<div class="page-head">
  <h1>Siparişler</h1>
  <a class="btn btn-sm btn-dark" href="/yonetim/siparisler.csv${filter.includeTest ? '?test=1' : ''}">Excel'e aktar (CSV)</a>
</div>
<form class="filters" method="get">
  <select name="durum"><option value="">Tüm durumlar</option>
    ${ORDER_STATUSES.map((s) => html`<option value="${s}" ${sel(filter.status, s)}>${ORDER_STATUS_LABELS[s]}</option>`)}
  </select>
  <select name="urun"><option value="">Tüm ürünler</option>
    ${products.map((p) => html`<option value="${p.id}" ${sel(filter.productId, p.id)}>${p.name}</option>`)}
  </select>
  <label class="check"><input type="checkbox" name="test" value="1" ${filter.includeTest ? 'checked' : ''}> Test siparişlerini göster</label>
  <button class="btn btn-sm btn-dark">Filtrele</button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th>No</th><th>Tarih</th><th>Müşteri</th><th>Ürün</th><th>Tutar</th><th>Ödeme</th><th>Durum</th><th>Kaynak</th></tr></thead>
  <tbody>
  ${orders.length ? '' : html`<tr><td colspan="8" class="muted">Sipariş yok.</td></tr>`}
  ${orders.map((o) => html`<tr class="${o.is_test ? 'dim' : ''}">
    <td><a href="/yonetim/siparisler/${o.id}">${o.order_no}</a>${o.is_test ? ' (test)' : ''}</td>
    <td>${formatDateTime(o.created_at)}</td>
    <td>${o.customer_name}<br><span class="muted small">${o.phone} · ${o.city}</span></td>
    <td>${o.product_name} × ${o.quantity}</td>
    <td>${formatTRY(o.total)}</td>
    <td>${o.payment_method === 'kapida' ? 'Kapıda' : 'Kart'}${o.payment_status === 'odendi' ? ' ✓' : o.payment_status === 'basarisiz' ? ' ✗' : ''}</td>
    <td><span class="tag tag-${o.status}">${ORDER_STATUS_LABELS[o.status]}</span></td>
    <td class="small">${o.utm_source || '–'}${o.utm_campaign ? ' / ' + o.utm_campaign : ''}</td>
  </tr>`)}
  </tbody>
</table></div>`);
}

export function orderPage(ctx, { order: o, events }) {
  return adminLayout(ctx, { title: o.order_no, path: '/siparisler' }, html`
<div class="page-head">
  <h1>Sipariş ${o.order_no}</h1>
  <span class="tag tag-${o.status}">${ORDER_STATUS_LABELS[o.status]}</span>
</div>
${o.is_test ? html`<div class="alert">Bu bir TEST siparişi. Raporlara dahil edilmez.</div>` : ''}
<div class="cols">
  <dl class="summary">
    <dt>Tarih</dt><dd>${formatDateTime(o.created_at)}</dd>
    <dt>Müşteri</dt><dd>${o.customer_name}</dd>
    <dt>Telefon</dt><dd><a href="tel:${o.phone}">${o.phone}</a></dd>
    <dt>Adres</dt><dd>${o.address}<br>${o.district} / ${o.city}</dd>
    ${o.note ? html`<dt>Not</dt><dd>${o.note}</dd>` : ''}
    <dt>Ürün</dt><dd>${o.product_name} × ${o.quantity}</dd>
    <dt>Tutar</dt><dd>${formatTRY(o.total)}</dd>
    <dt>Maliyet</dt><dd>${formatTRY(o.unit_cost * o.quantity)} ürün + ${formatTRY(o.shipping_cost)} kargo</dd>
    <dt>Brüt kâr</dt><dd>${formatTRY(o.total - o.unit_cost * o.quantity - o.shipping_cost)}</dd>
    <dt>Ödeme</dt><dd>${PAYMENT_METHODS[o.payment_method]} – ${PAYMENT_STATUS_LABELS[o.payment_status]}</dd>
    <dt>Kaynak</dt><dd>${[o.utm_source, o.utm_medium, o.utm_campaign, o.utm_content].filter(Boolean).join(' / ') || '–'}</dd>
  </dl>
  <form method="post" class="form">
    <label>Sipariş durumu
      <select name="status">${ORDER_STATUSES.map((s) => html`<option value="${s}" ${sel(o.status, s)}>${ORDER_STATUS_LABELS[s]}</option>`)}</select>
    </label>
    <label>Ödeme durumu
      <select name="payment_status">${Object.keys(PAYMENT_STATUS_LABELS).map((s) => html`<option value="${s}" ${sel(o.payment_status, s)}>${PAYMENT_STATUS_LABELS[s]}</option>`)}</select>
    </label>
    <label>Test siparişi mi?
      <select name="is_test"><option value="0" ${sel(o.is_test, 0)}>Hayır (gerçek)</option><option value="1" ${sel(o.is_test, 1)}>Evet (raporlara girmesin)</option></select>
    </label>
    <label>Not ekle <input name="note" placeholder="Örn: Müşteri arandı, teyit edildi"></label>
    <button class="btn btn-block">Kaydet</button>
    <p class="muted small">Siparişler silinmez. Gerekirse "İptal" durumuna alın.</p>
  </form>
</div>
<h2>Geçmiş</h2>
<ul class="timeline">${events.map((e) => html`<li><span class="muted small">${formatDateTime(e.created_at)}</span> ${e.event}</li>`)}</ul>
<p><a href="/yonetim/siparisler">← Siparişlere dön</a></p>`);
}

export function adsPage(ctx, { list, products, errors, form }) {
  return adminLayout(ctx, { title: 'Reklam harcamaları', path: '/reklam' }, html`
<h1>Reklam harcamaları</h1>
<p class="muted small">Her gün, her ürün ve kanal için reklam panelindeki harcamayı girin. Yanlış kayıt silinmez, "Geçersiz say" ile hesaptan çıkarılır.</p>
${errorBox(errors)}
<form method="post" class="form form-wide card-form">
  <div class="row-3">
    <label>Tarih <input type="date" name="spend_date" value="${form.spend_date || ''}" required></label>
    <label>Ürün
      <select name="product_id" required><option value="">Seçin</option>
        ${products.map((p) => html`<option value="${p.id}" ${sel(form.product_id, p.id)}>${p.name}${p.status === 'pasif' ? ' (pasif)' : ''}</option>`)}
      </select>
    </label>
    <label>Kanal
      <select name="channel">${AD_CHANNELS.map((c) => html`<option value="${c}" ${sel(form.channel, c)}>${AD_CHANNEL_LABELS[c]}</option>`)}</select>
    </label>
  </div>
  <div class="row-3">
    <label>Harcama (₺) <input name="amount" inputmode="decimal" required value="${form.amount || ''}" placeholder="250,00"></label>
    <label>Gösterim <input name="impressions" type="number" min="0" value="${form.impressions || ''}"></label>
    <label>Tıklama <input name="clicks" type="number" min="0" value="${form.clicks || ''}"></label>
  </div>
  <label>Not (kampanya adı vb.) <input name="note" value="${form.note || ''}"></label>
  <button class="btn">Ekle</button>
</form>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Tarih</th><th>Ürün</th><th>Kanal</th><th>Harcama</th><th>Gösterim</th><th>Tıklama</th><th>Not</th><th></th></tr></thead>
  <tbody>
  ${list.length ? '' : html`<tr><td colspan="8" class="muted">Henüz kayıt yok.</td></tr>`}
  ${list.map((a) => html`<tr class="${a.voided ? 'dim strike' : ''}">
    <td>${a.spend_date}</td><td>${a.product_name}</td><td>${AD_CHANNEL_LABELS[a.channel] || a.channel}</td>
    <td>${formatTRY(a.amount)}</td><td>${a.impressions}</td><td>${a.clicks}</td><td class="small">${a.note}</td>
    <td><form method="post" action="/yonetim/reklam/${a.id}/gecersiz"><button class="link-btn small">${a.voided ? 'Geri al' : 'Geçersiz say'}</button></form></td>
  </tr>`)}
  </tbody>
</table></div>`);
}
