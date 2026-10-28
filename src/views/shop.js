import { html } from '../html.js';
import { formatTRY } from '../money.js';
import { lines, faqItems } from '../products.js';
import { PAYMENT_METHODS, SITE_NAME } from '../config.js';

// ctx: { rt (ayarlar), testMode }

export function layout(ctx, { title, description, ogImage }, body) {
  const phoneHref = ctx.rt.contact.phone.replace(/[^\d+]/g, '');
  return html`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title || SITE_NAME}</title>
  <meta name="description" content="${description || 'AVM Milyoncu – popüler ürünler, uygun fiyat, kapıda ödeme.'}">
  <meta name="theme-color" content="#2B2F33">
  <link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/style.css">
  ${ogImage ? html`<meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">` : ''}
</head>
<body>
${ctx.testMode ? html`<div class="test-bar">TEST MODU – kartla ödeme simülasyondur, gerçek para çekilmez.</div>` : ''}
<header class="site-header">
  <div class="wrap header-inner">
    <a href="/" class="logo" aria-label="AVM Milyoncu ana sayfa"><span class="logo-mark">AVM</span><span class="logo-text">Milyoncu</span></a>
    <a class="header-contact" href="tel:${phoneHref}">${ctx.rt.contact.phone}</a>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <div>
      <div class="logo logo-light"><span class="logo-mark">AVM</span><span class="logo-text">Milyoncu</span></div>
      <p class="muted">Popüler ürünler, uygun fiyat, kapıda ödeme.</p>
    </div>
    <nav class="footer-links">
      <a href="/iletisim">İletişim</a>
      <a href="/iade-ve-degisim">İade ve Değişim</a>
      <a href="/mesafeli-satis-sozlesmesi">Mesafeli Satış Sözleşmesi</a>
      <a href="/gizlilik-ve-kvkk">Gizlilik ve KVKK</a>
    </nav>
  </div>
  <div class="wrap copyright">© ${new Date().getFullYear()} avmmilyoncu.com</div>
</footer>
</body>
</html>`;
}

const badges = html`<ul class="badges">
  <li><strong>Kapıda ödeme</strong><span>Nakit veya kart</span></li>
  <li><strong>Hızlı kargo</strong><span>1-2 iş gününde kargoda</span></li>
  <li><strong>14 gün iade</strong><span>Koşulsuz iade hakkı</span></li>
</ul>`;

function card(p) {
  return html`<a class="card" href="/urun/${p.slug}">
  <div class="card-img"><img src="${p.image || '/img/placeholder.svg'}" alt="${p.name}" loading="lazy" width="400" height="400"></div>
  <div class="card-body">
    <h3>${p.name}</h3>
    <div class="price-row">
      <span class="price">${formatTRY(p.price)}</span>
      ${p.compare_price > p.price ? html`<s class="old">${formatTRY(p.compare_price)}</s>` : ''}
    </div>
    <span class="btn btn-sm">İncele</span>
  </div>
</a>`;
}

export function homePage(ctx, products) {
  return layout(ctx, {}, html`
<section class="hero">
  <div class="wrap">
    <h1>Popüler ürünler, <span class="accent">uygun fiyat</span></h1>
    <p>Seçilmiş ürünler kapıda ödeme ve hızlı kargo ile kapınızda.</p>
  </div>
</section>
<section class="wrap section">
  ${badges}
  <h2 class="section-title">Ürünler</h2>
  ${products.length ? '' : html`<p class="muted">Şu an satışta ürün bulunmuyor. Yakında yeni ürünlerle buradayız.</p>`}
  <div class="grid">${products.map(card)}</div>
</section>`);
}

export function productPage(ctx, { product, others, methods, form, errors }) {
  const meta = {
    title: `${product.name} | ${SITE_NAME}`,
    description: product.headline || product.description,
    ogImage: product.image ? (product.image.startsWith('http') ? product.image : ctx.rt.siteUrl + product.image) : '',
  };
  if (product.status !== 'aktif') {
    return layout(ctx, meta, html`
<section class="wrap section">
  <div class="notice">
    <h1>${product.name}</h1>
    <p>Bu ürün şu an satışta değil. Aşağıdaki ürünlerimize göz atabilirsiniz.</p>
  </div>
  <div class="grid">${others.map(card)}</div>
</section>`);
  }
  const discount = product.compare_price > product.price ? Math.round((1 - product.price / product.compare_price) * 100) : 0;
  const qty = Number(form.quantity) || 1;
  const faq = faqItems(product.faq);
  const val = (k) => form[k] || '';

  return layout(ctx, meta, html`
<section class="product-hero wrap">
  <div class="product-media">
    ${discount ? html`<span class="ribbon">%${discount} indirim</span>` : ''}
    <img src="${product.image || '/img/placeholder.svg'}" alt="${product.name}" width="600" height="600" fetchpriority="high">
  </div>
  <div class="product-info">
    <h1>${product.name}</h1>
    ${product.headline ? html`<p class="headline">${product.headline}</p>` : ''}
    <div class="price-row big">
      <span class="price">${formatTRY(product.price)}</span>
      ${discount ? html`<s class="old">${formatTRY(product.compare_price)}</s>` : ''}
    </div>
    <ul class="features">${lines(product.features).map((f) => html`<li>${f}</li>`)}</ul>
    <a href="#siparis" class="btn btn-block btn-lg">Hemen Sipariş Ver</a>
    ${badges}
  </div>
</section>

${product.description ? html`<section class="wrap section">
  <h2 class="section-title">Ürün hakkında</h2>
  <div class="prose">${lines(product.description).map((l) => html`<p>${l}</p>`)}</div>
</section>` : ''}

<section class="wrap section" id="siparis">
  <div class="order-box">
    <h2>Sipariş formu</h2>
    <p class="muted">Formu doldurun, siparişinizi telefonla teyit edelim.</p>
    ${errors.length ? html`<div class="alert" role="alert"><ul>${errors.map((e) => html`<li>${e}</li>`)}</ul></div>` : ''}
    <form method="post" action="/siparis#siparis" class="form" novalidate>
      <input type="hidden" name="product_id" value="${product.id}">
      <div class="hp" aria-hidden="true"><label>Web sitesi <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <label>Adet
        <select name="quantity" id="qty" data-price="${product.price}">
          ${[1, 2, 3, 4, 5].map((i) => html`<option value="${i}" ${qty === i ? 'selected' : ''}>${i}</option>`)}
        </select>
      </label>
      <label>Ad Soyad <input name="customer_name" required autocomplete="name" value="${val('customer_name')}"></label>
      <label>Cep telefonu <input name="phone" type="tel" inputmode="tel" required autocomplete="tel" placeholder="05xx xxx xx xx" value="${val('phone')}"></label>
      <div class="row-2">
        <label>İl <input name="city" required autocomplete="address-level1" value="${val('city')}"></label>
        <label>İlçe <input name="district" autocomplete="address-level2" value="${val('district')}"></label>
      </div>
      <label>Açık adres <textarea name="address" rows="3" required autocomplete="street-address">${val('address')}</textarea></label>
      <label>Sipariş notu (isteğe bağlı) <input name="note" value="${val('note')}"></label>
      <fieldset class="pay">
        <legend>Ödeme yöntemi</legend>
        ${Object.keys(methods).map((k) => html`<label class="radio"><input type="radio" name="payment_method" value="${k}" ${form.payment_method === k ? 'checked' : ''}> ${methods[k]}</label>`)}
      </fieldset>
      <label class="check"><input type="checkbox" name="onay" value="1" ${form.onay ? 'checked' : ''}>
        <span><a href="/mesafeli-satis-sozlesmesi" target="_blank">Mesafeli satış sözleşmesini</a> okudum, onaylıyorum.</span></label>
      <div class="total">Toplam: <strong id="total">${formatTRY(product.price * qty)}</strong></div>
      <button class="btn btn-block btn-lg" type="submit">Siparişi Tamamla</button>
    </form>
  </div>
</section>

${faq.length ? html`<section class="wrap section">
  <h2 class="section-title">Sıkça sorulan sorular</h2>
  <div class="faq">${faq.map((f) => html`<details><summary>${f.q}</summary><p>${f.a}</p></details>`)}</div>
</section>` : ''}

${others.length ? html`<section class="wrap section">
  <h2 class="section-title">Diğer ürünler</h2>
  <div class="grid">${others.map(card)}</div>
</section>` : ''}

<div class="sticky-cta">
  <div><span class="price">${formatTRY(product.price)}</span>${discount ? html` <s class="old">${formatTRY(product.compare_price)}</s>` : ''}</div>
  <a href="#siparis" class="btn">Sipariş Ver</a>
</div>
<script>
  (function () {
    var q = document.getElementById('qty'), t = document.getElementById('total');
    var f = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
    q.addEventListener('change', function () { t.textContent = f.format(q.dataset.price * q.value / 100); });
  })();
</script>`);
}

export function thanksPage(ctx, order) {
  if (order.payment_status === 'basarisiz') {
    return layout(ctx, { title: 'Ödeme alınamadı' }, html`
<section class="wrap section narrow"><div class="notice">
  <h1>Ödeme alınamadı</h1>
  <p>Kart ödemesi tamamlanamadı, siparişiniz iptal edildi. Dilerseniz kapıda ödeme ile tekrar sipariş verebilirsiniz.</p>
  <a class="btn" href="/">Ürünlere dön</a>
</div></section>`);
  }
  return layout(ctx, { title: 'Siparişiniz alındı' }, html`
<section class="wrap section narrow">
  <div class="success">
    <div class="check-icon" aria-hidden="true">✓</div>
    <h1>Siparişiniz alındı</h1>
    <p>Teşekkürler ${order.customer_name.split(' ')[0]}! Siparişinizi teyit etmek için kısa süre içinde sizi arayacağız.</p>
  </div>
  <dl class="summary">
    <dt>Sipariş no</dt><dd>${order.order_no}</dd>
    <dt>Ürün</dt><dd>${order.product_name} × ${order.quantity}</dd>
    <dt>Toplam</dt><dd>${formatTRY(order.total)}</dd>
    <dt>Ödeme</dt><dd>${PAYMENT_METHODS[order.payment_method]}${order.payment_status === 'odendi' ? ' (ödendi)' : ''}</dd>
  </dl>
  <a class="btn" href="/">Alışverişe devam et</a>
</section>`);
}

export function testPaymentPage(ctx, order) {
  return layout(ctx, { title: 'Test ödeme' }, html`
<section class="wrap section narrow"><div class="notice">
  <h1>Test ödeme ekranı</h1>
  <p>Bu ekran yalnızca test içindir. Gerçek kart bilgisi girilmez, para çekilmez.</p>
  <dl class="summary">
    <dt>Sipariş no</dt><dd>${order.order_no}</dd>
    <dt>Tutar</dt><dd>${formatTRY(order.total)}</dd>
  </dl>
  ${order.payment_status === 'bekliyor' ? html`<form method="post" class="btn-row">
    <button class="btn" name="sonuc" value="basarili">Ödeme başarılı</button>
    <button class="btn btn-dark" name="sonuc" value="basarisiz">Ödeme başarısız</button>
  </form>` : html`<a class="btn" href="/siparis/${order.order_no}">Siparişe git</a>`}
</div></section>`);
}

export function messagePage(ctx, heading, text) {
  return layout(ctx, { title: heading }, html`
<section class="wrap section narrow"><div class="notice">
  <h1>${heading}</h1>
  <p>${text}</p>
  <a class="btn" href="/">Ana sayfaya dön</a>
</div></section>`);
}

// Yasal ve bilgi sayfaları (taslak metinler).
export const PAGES = {
  'iletisim': {
    title: 'İletişim',
    body: (ctx) => html`
  <p>Sorularınız, siparişleriniz ve iade talepleriniz için bize ulaşabilirsiniz.</p>
  <ul>
    <li>Telefon: <a href="tel:${ctx.rt.contact.phone.replace(/[^\d+]/g, '')}">${ctx.rt.contact.phone}</a></li>
    <li>E-posta: <a href="mailto:${ctx.rt.contact.email}">${ctx.rt.contact.email}</a></li>
    ${ctx.rt.contact.whatsapp ? html`<li>WhatsApp: <a href="https://wa.me/${ctx.rt.contact.whatsapp}">Mesaj gönderin</a></li>` : ''}
  </ul>
  <p class="muted">Çalışma saatleri: Hafta içi 09:00 – 18:00</p>`,
  },
  'iade-ve-degisim': {
    title: 'İade ve Değişim',
    body: () => html`
  <p>Ürünü teslim aldığınız tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeden iade edebilirsiniz.</p>
  <ul>
    <li>İade için önce bizimle iletişime geçin, size iade kodunu iletelim.</li>
    <li>Ürün kullanılmamış ve orijinal ambalajında olmalıdır.</li>
    <li>Ücret iadesi, ürün bize ulaştıktan sonra en geç 14 gün içinde yapılır.</li>
  </ul>
  <p class="muted">Not: Bu metin örnektir. Yayına almadan önce işletme bilgilerinize göre güncelleyin.</p>`,
  },
  'mesafeli-satis-sozlesmesi': {
    title: 'Mesafeli Satış Sözleşmesi',
    body: () => html`
  <p><strong>Satıcı:</strong> [Firma unvanı], [Adres], [Vergi dairesi / no], [Telefon], [E-posta]</p>
  <p><strong>Alıcı:</strong> Sipariş formunda bilgileri yer alan kişi.</p>
  <h2>Konu</h2>
  <p>Bu sözleşme, alıcının avmmilyoncu.com üzerinden sipariş verdiği ürünün satışı ve teslimine ilişkin
     6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamındaki hak ve
     yükümlülükleri düzenler.</p>
  <h2>Teslimat</h2>
  <p>Ürün, sipariş teyidinden sonra en geç 30 gün içinde alıcının bildirdiği adrese kargo ile teslim edilir.</p>
  <h2>Cayma hakkı</h2>
  <p>Alıcı, ürünü teslim aldığı tarihten itibaren 14 gün içinde gerekçe göstermeden cayma hakkına sahiptir.</p>
  <p class="muted">Not: Bu metin taslaktır. Yayına almadan önce bir hukukçuya kontrol ettirip firma bilgilerinizi ekleyin.</p>`,
  },
  'gizlilik-ve-kvkk': {
    title: 'Gizlilik ve KVKK',
    body: (ctx) => html`
  <p>Sipariş formunda paylaştığınız ad, telefon ve adres bilgileri yalnızca siparişinizin teyidi, teslimatı ve
     yasal yükümlülüklerin yerine getirilmesi amacıyla 6698 sayılı KVKK kapsamında işlenir.</p>
  <p>Bilgileriniz kargo firması dışında üçüncü kişilerle paylaşılmaz. Reklam performansını ölçmek için hangi
     reklamdan geldiğiniz bilgisi (UTM) siparişle birlikte saklanır.</p>
  <p>Haklarınızla ilgili taleplerinizi <a href="mailto:${ctx.rt.contact.email}">${ctx.rt.contact.email}</a> adresine iletebilirsiniz.</p>
  <p class="muted">Not: Bu metin taslaktır. Yayına almadan önce firma bilgilerinizle güncelleyin.</p>`,
  },
};

export function infoPage(ctx, key) {
  const p = PAGES[key];
  return layout(ctx, { title: `${p.title} | ${SITE_NAME}` }, html`
<section class="wrap section narrow prose">
  <h1>${p.title}</h1>
  ${p.body(ctx)}
</section>`);
}
