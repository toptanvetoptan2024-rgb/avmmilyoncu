import { html, raw } from '../html.js';
import { formatTRY } from '../money.js';
import { SITE_NAME } from '../config.js';
import { STOCK_LABELS, MAX_SHOWN, hasAds } from '../catalog.js';
import { ILLER } from '../iller.js';
import { MAX_QTY } from '../orders.js';
import { secondsToEndOfDayTR } from '../time.js';

// ctx: { rt (ortam ayarları), store (magaza.json ayarları) }

const ICONS = {
  truck: '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  headset: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  return: '<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 010 10h-3"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.2 1.2-3.6 2.4-4.6.2 1.6 1 2.6 2.1 3.1C11 9 10.8 6 12 3z"/>',
  dot: '<circle cx="12" cy="12" r="3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
};
export const icon = (name, cls = 'ico') => raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`);

const brand = html`<a href="/" class="brand" aria-label="AVM Milyoncu ana sayfa">
  <span class="brand-bag">AVM</span>
  <span class="brand-text"><span class="brand-name">MİLYONCU</span><span class="brand-tag">Çok Satan Ürünler, Avantajlı Fiyatlar</span></span>
</a>`;

function trustItems(ctx) {
  const c = ctx.store.contact;
  const support = c.whatsapp ? 'WhatsApp ve telefonla' : c.phone ? 'Telefonla yanınızdayız' : 'Sorularınız için yazın';
  return [
    ['truck', 'Hızlı Kargo', "Türkiye'nin her yerine"],
    ['shield', 'Güvenli Alışveriş', 'Bilgileriniz şifreli bağlantıyla korunur'],
    ['tag', 'Uygun Fiyatlar', 'Avantajlı kampanya fiyatları'],
    ['headset', 'Destek', support],
  ];
}

export function layout(ctx, { title, description }, body) {
  const c = ctx.store.contact;
  return html`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title || `${SITE_NAME} – Çok Satan Ürünler, Avantajlı Fiyatlar`}</title>
  <meta name="description" content="${description || 'AVM Milyoncu: çok satan ürünler, avantajlı fiyatlar, hızlı kargo.'}">
  <meta name="theme-color" content="#111111">
  <link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/style.css?v=6">
</head>
<body>
<div class="topbar"><div class="wrap topbar-in">
  ${trustItems(ctx).map(([i, t, d]) => html`<div class="tb-item">${icon(i)}<div><strong>${t}</strong><span>${d}</span></div></div>`)}
</div></div>
<header class="header"><div class="wrap header-in">
  <details class="menu">
    <summary aria-label="Menü">${icon('menu')}</summary>
    <nav class="menu-list">
      <a href="/#urunler">Ürünler</a>
      <a href="/#sepet">Sepetim</a>
      <a href="/iletisim">İletişim</a>
      <a href="/iade-ve-degisim">İade ve Değişim</a>
    </nav>
  </details>
  ${brand}
  <div class="header-badges">
    <div>${icon('lock')}<span>Güvenli Alışveriş</span></div>
    <div>${icon('truck')}<span>Hızlı Kargo</span></div>
    <div>${icon('return')}<span>Kolay İade</span></div>
  </div>
  <a href="/#sepet" class="cart-btn" aria-label="Sepet">${icon('cart')}<span class="cart-count" data-cart-count hidden>0</span></a>
</div></header>
<main>
${body}
</main>
${hasAds(ctx.store) ? html`<div class="cerez" data-cerez hidden role="dialog" aria-live="polite" aria-label="Çerez tercihi">
  <p>Reklamlarımızın etkisini ölçmek için Meta, TikTok ve Google çerezlerini kullanmak istiyoruz. Onay vermezseniz bu çerezler
    çalışmaz; alışverişiniz etkilenmez. <a href="/gizlilik-ve-kvkk">Ayrıntılar</a></p>
  <div class="cerez-btns"><button type="button" class="btn btn-light" data-cerez-red>Reddet</button>
    <button type="button" class="btn btn-orange" data-cerez-kabul>Kabul et</button></div>
</div>` : ''}
<footer class="footer">
  <div class="wrap footer-trust">
    ${[['truck', 'Hızlı Kargo', "Türkiye'nin her yerine"], ['shield', 'Güvenli Alışveriş', 'Şifreli bağlantı'],
    ['box', 'Kolay İade', '14 gün içinde iade hakkı'], ['headset', 'Destek', c.phone || c.email || 'İletişim sayfamızdan ulaşın']]
    .map(([i, t, d]) => html`<div class="ft-item">${icon(i)}<div><strong>${t}</strong><span>${d}</span></div></div>`)}
  </div>
  <div class="footer-bottom"><div class="wrap footer-bottom-in">
    <span>© ${new Date().getFullYear()} avmmilyoncu.com</span>
    <nav>
      <a href="/iletisim">İletişim</a>
      <a href="/iade-ve-degisim">İade ve Değişim</a>
      <a href="/mesafeli-satis-sozlesmesi">Mesafeli Satış Sözleşmesi</a>
      <a href="/gizlilik-ve-kvkk">Gizlilik ve KVKK</a>
      ${hasAds(ctx.store) ? html`<a href="#" data-cerez-ac>Çerez tercihleri</a>` : ''}
    </nav>
  </div></div>
</footer>
${hasAds(ctx.store) ? html`<script id="reklam-ayarlari" type="application/json">${raw(JSON.stringify(ctx.store.ads))}</script>
<script src="/js/reklam.js?v=1" defer></script>` : ''}
</body>
</html>`;
}

const pad2 = (n) => String(n).padStart(2, '0');

// Kampanya alanı: başlık, alt metin, en yüksek gerçek indirim oranı ve gün sonuna kadar sayaç.
function campaign(ctx, products) {
  const k = ctx.store.campaign;
  if (!k.active) return '';
  const maxOff = Math.max(0, ...products.map((p) => (p.compare_price > p.price ? Math.round((1 - p.price / p.compare_price) * 100) : 0)));
  const left = secondsToEndOfDayTR();
  const parts = [[Math.floor(left / 3600), 'SAAT', 's'], [Math.floor((left % 3600) / 60), 'DAKİKA', 'd'], [left % 60, 'SANİYE', 'sn']];
  return html`<section class="promo" aria-label="Kampanya">
  <div class="wrap promo-in">
    ${maxOff ? html`<div class="promo-badge" aria-hidden="true"><b>%${maxOff}'a</b><span>varan</span><strong>İNDİRİMLER</strong></div>` : ''}
    <div class="promo-text">
      <p class="promo-title">${icon('flame', 'ico promo-flame')}${k.title}</p>
      ${k.subtitle ? html`<p class="promo-sub">${k.subtitle}</p>` : ''}
    </div>
    ${k.countdown ? html`<div class="promo-timer" data-sayac="${left}" role="timer" aria-label="Kampanyanın bitmesine kalan süre">
      <p>Kampanyanın Bitmesine Kalan Süre</p>
      <div class="timer-boxes">
        ${parts.map(([v, label, key]) => html`<div><span data-sayac-${key}>${pad2(v)}</span><small>${label}</small></div>`)}
      </div>
    </div>` : ''}
  </div>
</section>`;
}

const step = (n, title, sub) => html`<div class="step-head"><span class="step-no">${n}</span><div><h2>${title}</h2>${sub ? html`<p>${sub}</p>` : ''}</div></div>`;

function productCard(p) {
  const discount = p.compare_price > p.price ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const soldOut = p.stock === 'tukendi';
  const features = String(p.features_list || '').split('\n').filter(Boolean);
  return html`<article class="card" id="urun-${p.slug}" data-product="${p.slug}">
  <div class="card-top${features.length ? '' : ' no-feat'}">
    <div class="card-img">
      ${discount ? html`<span class="badge"><b>%${discount}</b>indirim</span>` : ''}
      <img src="${p.image || '/img/placeholder.svg'}" alt="${p.name}" width="600" height="400" loading="lazy">
    </div>
    ${features.length ? html`<ul class="feats">${features.map((f) => html`<li>${icon('check', 'ico feat-ico')}<span>${f}</span></li>`)}</ul>` : ''}
  </div>
  <div class="card-body">
    <h3>${p.name}</h3>
    ${p.headline ? html`<p class="card-sub">${p.headline}</p>` : ''}
    <div class="prices">
      ${discount ? html`<s>${formatTRY(p.compare_price)}</s>` : ''}
      <strong>${formatTRY(p.price)}</strong>
    </div>
    <p class="stock stock-${p.stock}">${STOCK_LABELS[p.stock]}</p>
    <div class="card-actions">
      <div class="qty" data-qty>
        <button type="button" data-dec aria-label="Azalt" ${soldOut ? 'disabled' : ''}>−</button>
        <input type="number" value="1" min="1" max="${MAX_QTY}" inputmode="numeric" aria-label="${p.name} adet" ${soldOut ? 'disabled' : ''}>
        <button type="button" data-inc aria-label="Artır" ${soldOut ? 'disabled' : ''}>+</button>
      </div>
      <button type="button" class="btn btn-orange" data-add ${soldOut ? 'disabled' : ''}>${icon('cart')} ${soldOut ? 'Tükendi' : 'Sepete Ekle'}</button>
    </div>
  </div>
</article>`;
}

const field = (name, label, input, { required, hint, wide } = {}) => html`<div class="field${wide ? ' wide' : ''}" data-field="${name}">
  <label for="f-${name}">${label}${required ? html` <span class="req">*</span>` : html` <span class="opt">(isteğe bağlı)</span>`}</label>
  ${input}
  ${hint ? html`<small class="hint">${hint}</small>` : ''}
  <small class="err" id="e-${name}" aria-live="polite"></small>
</div>`;

export function homePage(ctx, { products, options, highlight, admin }) {
  const shown = products.slice(0, MAX_SHOWN);
  const anyMethod = options.some((o) => o.enabled);
  const anyPublic = options.some((o) => o.enabled && o.code !== 'test');
  const firstEnabled = options.find((o) => o.enabled);
  const c = ctx.store.contact;
  const data = {
    products: shown.map((p) => ({
      kod: p.slug, ad: p.name, fiyat: p.price, eskiFiyat: p.compare_price, gorsel: p.image, stok: p.stock,
    })),
    kargoUcreti: ctx.store.shippingFee,
    maxAdet: MAX_QTY,
    odeme: options.map((o) => ({ kod: o.code, ad: o.title, aktif: o.enabled })),
    vurgula: highlight || '',
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return layout(ctx, {}, html`
${campaign(ctx, shown)}
<div class="wrap shop">
  <section class="sec sec-products" id="urunler">
    ${step(1, 'Ürünlerinizi Seçin', 'En çok satan ürünlerde kaçırılmayacak fiyatlar!')}
    ${shown.length ? html`<div class="cards">${shown.map(productCard)}</div>`
    : html`<p class="empty">Şu an satışta ürün bulunmuyor. Yakında yeni ürünlerle buradayız.</p>`}
  </section>

  <section class="sec sec-cart" id="sepet">
    ${step(2, 'Sepetiniz', '')}
    <div class="panel">
      <div class="cart-empty" data-cart-empty>Sepetiniz boş. Yukarıdan ürün seçip <strong>Sepete Ekle</strong>'ye basın.</div>
      <ul class="cart-list" data-cart-list></ul>
      <div class="cart-totals" data-cart-totals hidden>
        <div class="cart-ship">${icon('truck')}<div><strong>Tüm Türkiye'ye Hızlı Kargo</strong><span>${ctx.store.deliveryText}</span></div></div>
        <dl>
          <dt>Ara toplam</dt><dd data-subtotal>0</dd>
          <dt>Kargo</dt><dd data-shipping>${ctx.store.shippingFee ? formatTRY(ctx.store.shippingFee) : 'Ücretsiz'}</dd>
          <dt class="grand">Toplam Tutar</dt><dd class="grand" data-total>0</dd>
        </dl>
      </div>
    </div>
  </section>

  <form class="checkout" id="siparis-formu" novalidate>
    <section class="sec sec-address" id="adres">
      ${step(3, 'Adres Bilgilerinizi Girin', '')}
      <div class="panel form-grid">
        ${field('ad', 'Ad', html`<input id="f-ad" name="ad" autocomplete="given-name" required maxlength="50">`, { required: true })}
        ${field('soyad', 'Soyad', html`<input id="f-soyad" name="soyad" autocomplete="family-name" required maxlength="50">`, { required: true })}
        ${field('telefon', 'Telefon', html`<input id="f-telefon" name="telefon" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" required maxlength="20">`, { required: true })}
        ${field('eposta', 'E-posta', html`<input id="f-eposta" name="eposta" type="email" inputmode="email" autocomplete="email" maxlength="120">`)}
        ${field('il', 'İl', html`<select id="f-il" name="il" autocomplete="address-level1" required><option value="">İl seçin</option>${ILLER.map((il) => html`<option>${il}</option>`)}</select>`, { required: true })}
        ${field('ilce', 'İlçe', html`<input id="f-ilce" name="ilce" autocomplete="address-level2" required maxlength="60">`, { required: true })}
        ${field('mahalle', 'Mahalle', html`<input id="f-mahalle" name="mahalle" required maxlength="80">`, { required: true })}
        ${field('postaKodu', 'Posta kodu', html`<input id="f-postaKodu" name="postaKodu" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="34000">`)}
        ${field('adres', 'Açık adres', html`<textarea id="f-adres" name="adres" rows="2" autocomplete="street-address" required maxlength="500" placeholder="Sokak / cadde, bina no, daire no"></textarea>`, { required: true, wide: true })}
        ${field('not', 'Sipariş notu', html`<textarea id="f-not" name="not" rows="2" maxlength="500"></textarea>`, { wide: true })}
        <div class="hp" aria-hidden="true"><label>Web sitesi <input name="website" tabindex="-1" autocomplete="off"></label></div>
      </div>
    </section>

    <section class="sec sec-pay" id="odeme">
      ${step(4, 'Siparişi Tamamla', '')}
      <div class="panel">
        <div class="pay-options" data-field="odeme">
          ${options.map((o) => html`<label class="pay-opt${o.enabled ? '' : ' off'}">
            <input type="radio" name="odemeYontemi" value="${o.code}" ${o.enabled ? '' : 'disabled'} ${firstEnabled && firstEnabled.code === o.code ? 'checked' : ''}>
            <span class="pay-txt"><strong>${o.title}</strong><small>${o.description}</small></span>
            ${o.note ? html`<span class="pay-note">${o.note}</span>` : ''}
          </label>`)}
          <small class="err" id="e-odeme" aria-live="polite"></small>
        </div>
        ${admin ? html`<div class="notice-box">Yönetici olarak giriş yaptınız. <strong>Test Siparişi</strong> seçeneğiyle deneme siparişi
          verebilirsiniz; bu sipariş panelde "test" olarak işaretlenir, raporlara ve reklam piksellerine gitmez.</div>` : ''}
        ${anyPublic || admin ? '' : html`<div class="notice-box">Şu anda online sipariş alınmıyor. Ödeme seçenekleri çok yakında açılacak.${c.phone ? html` Sipariş için bizi arayabilirsiniz: <a href="tel:${c.phone.replace(/[^\d+]/g, '')}">${c.phone}</a>` : ''}</div>`}
        <div class="field check" data-field="onay">
          <label><input type="checkbox" name="onay" value="1">
            <span><a href="/mesafeli-satis-sozlesmesi" target="_blank">Mesafeli satış sözleşmesini</a> ve <a href="/gizlilik-ve-kvkk" target="_blank">gizlilik politikasını</a> okudum, kabul ediyorum. <span class="req">*</span></span></label>
          <small class="err" id="e-onay" aria-live="polite"></small>
        </div>
        <div class="form-alert" data-form-alert role="alert" hidden></div>
        <button type="submit" class="btn btn-green btn-block" data-submit ${anyMethod ? '' : 'disabled'}>${icon('check')} Siparişi Tamamla</button>
        <p class="secure-note">${icon('lock', 'ico ico-sm')} Bilgileriniz şifreli bağlantıyla gönderilir ve yalnızca siparişiniz için kullanılır.</p>
      </div>
    </section>
  </form>

  <section class="sec sec-done" id="tamamlandi" hidden>
    <div class="panel done">
      <div class="done-icon">${icon('check')}</div>
      <p class="test-flag" data-done-test hidden>TEST SİPARİŞİ: raporlara ve reklamlara yansımaz, yönetim panelinde "Test" sekmesinde görünür.</p>
      <h2>Siparişiniz alındı</h2>
      <p>Sipariş numaranız: <strong data-done-no></strong></p>
      <p class="muted">Siparişinizi teyit etmek için sizi telefonla arayacağız. Bu numarayı not almanızı öneririz.</p>
      <div data-done-summary></div>
      <a href="/" class="btn btn-orange">Alışverişe devam et</a>
    </div>
  </section>
</div>

<dialog class="confirm" id="onay-penceresi" aria-labelledby="onay-baslik">
  <form method="dialog" class="confirm-in">
    <h2 id="onay-baslik">Siparişinizi kontrol edin</h2>
    <div data-confirm-body></div>
    <div class="form-alert" data-confirm-alert role="alert" hidden></div>
    <div class="confirm-actions">
      <button value="cancel" class="btn btn-light" data-confirm-cancel>Düzenle</button>
      <button value="ok" class="btn btn-green" data-confirm-ok>${icon('check')} Onayla ve Siparişi Ver</button>
    </div>
  </form>
</dialog>

<div class="mobile-bar" data-mobile-bar>
  <a href="#sepet" class="btn btn-orange btn-block" data-go-checkout>${icon('cart')}
    <span>Sepetim ve Siparişi Tamamla</span><span class="mb-count" data-mb-summary hidden></span></a>
</div>

<div class="toast" data-toast role="status" aria-live="polite"></div>
<noscript><div class="notice-box wrap">Sipariş verebilmek için tarayıcınızda JavaScript açık olmalıdır.</div></noscript>
<script id="magaza-verisi" type="application/json">${raw(json)}</script>
<script src="/js/magaza.js?v=8" defer></script>`);
}

export function messagePage(ctx, heading, text) {
  return layout(ctx, { title: heading }, html`
<section class="wrap sec narrow"><div class="panel">
  <h1>${heading}</h1>
  <p>${text}</p>
  <a class="btn btn-orange" href="/">Ana sayfaya dön</a>
</div></section>`);
}

// Yasal ve bilgi sayfaları (taslak metinler).
export const PAGES = {
  'iletisim': {
    title: 'İletişim',
    body: (ctx) => {
      const c = ctx.store.contact;
      return html`
  <p>Sorularınız, siparişleriniz ve iade talepleriniz için bize ulaşabilirsiniz.</p>
  ${c.phone || c.email || c.whatsapp ? html`<ul>
    ${c.phone ? html`<li>Telefon: <a href="tel:${c.phone.replace(/[^\d+]/g, '')}">${c.phone}</a></li>` : ''}
    ${c.email ? html`<li>E-posta: <a href="mailto:${c.email}">${c.email}</a></li>` : ''}
    ${c.whatsapp ? html`<li>WhatsApp: <a href="https://wa.me/${c.whatsapp}">Mesaj gönderin</a></li>` : ''}
  </ul>` : html`<p class="muted">İletişim bilgileri yakında eklenecek.</p>`}`;
    },
  },
  'iade-ve-degisim': {
    title: 'İade ve Değişim',
    body: () => html`
  <p>Ürünü teslim aldığınız tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeden iade edebilirsiniz.</p>
  <ul>
    <li>İade için önce bizimle iletişime geçin, size iade bilgilerini iletelim.</li>
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
  <p>Bu sözleşme, alıcının avmmilyoncu.com üzerinden sipariş verdiği ürünlerin satışı ve teslimine ilişkin
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
  <p>Sipariş formunda paylaştığınız ad, soyad, telefon, e-posta ve adres bilgileri yalnızca siparişinizin teyidi,
     teslimatı ve yasal yükümlülüklerin yerine getirilmesi amacıyla 6698 sayılı KVKK kapsamında işlenir.</p>
  <p>Bilgileriniz kargo firması dışında üçüncü kişilerle paylaşılmaz. Reklam performansını ölçmek için hangi
     reklamdan geldiğiniz bilgisi (UTM) siparişle birlikte saklanır. Sepetinizdeki ürünler yalnızca kendi
     tarayıcınızda tutulur; adres bilgileriniz tarayıcınıza kaydedilmez.</p>
  ${hasAds(ctx.store) ? html`<h2>Çerezler ve reklam ölçümü</h2>
  <p>Onay vermeniz halinde reklamlarımızın performansını ölçmek için şu hizmetlerin çerezleri kullanılır:
     ${[ctx.store.ads.meta && 'Meta (Facebook/Instagram)', ctx.store.ads.tiktok && 'TikTok', ctx.store.ads.google && 'Google'].filter(Boolean).join(', ')}.
     Bu hizmetlere ad, telefon veya adres bilginiz gönderilmez; yalnızca sayfa ziyareti, sepete ekleme ve sipariş tutarı gibi
     bilgiler iletilir. Tercihinizi sayfanın altındaki "Çerez tercihleri" bağlantısından istediğiniz zaman değiştirebilirsiniz.</p>` : ''}
  ${ctx.store.contact.email ? html`<p>Haklarınızla ilgili taleplerinizi <a href="mailto:${ctx.store.contact.email}">${ctx.store.contact.email}</a> adresine iletebilirsiniz.</p>` : ''}
  <p class="muted">Not: Bu metin taslaktır. Yayına almadan önce firma bilgilerinizle güncelleyin.</p>`,
  },
};

export function infoPage(ctx, key) {
  const p = PAGES[key];
  return layout(ctx, { title: `${p.title} | ${SITE_NAME}` }, html`
<section class="wrap sec narrow prose">
  <h1>${p.title}</h1>
  ${p.body(ctx)}
</section>`);
}
