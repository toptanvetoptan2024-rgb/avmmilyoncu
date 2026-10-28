/* AVM Milyoncu – sepet ve sipariş formu.
 * Sepet yalnızca ürün kodları ve adetlerle tarayıcıda (localStorage) tutulur.
 * Adres bilgileri tarayıcıya KAYDEDİLMEZ. Fiyatlar ve toplamlar sunucuda yeniden hesaplanır. */
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('magaza-verisi').textContent);
  var CART_KEY = 'avm_sepet_v1';
  var ORDER_KEY = 'avm_siparis_anahtari';
  var MAX = DATA.maxAdet || 10;
  var products = {};
  DATA.products.forEach(function (p) { products[p.kod] = p; });

  var fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
  var money = function (k) { return fmt.format((k || 0) / 100); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); }
    catch (e) { return null; }
    return null;
  }

  // ---------- Sepet ----------
  var cart = {};
  try { cart = JSON.parse(store(CART_KEY) || '{}') || {}; } catch (e) { cart = {}; }
  function clean() {
    Object.keys(cart).forEach(function (k) {
      var q = parseInt(cart[k], 10);
      if (!products[k] || products[k].stok === 'tukendi' || !(q > 0)) delete cart[k];
      else cart[k] = Math.min(q, MAX);
    });
  }
  function save() { store(CART_KEY, JSON.stringify(cart)); }
  function lines() {
    return Object.keys(cart).map(function (k) { return { p: products[k], adet: cart[k] }; });
  }
  function subtotal() { return lines().reduce(function (s, l) { return s + l.p.fiyat * l.adet; }, 0); }
  function count() { return lines().reduce(function (s, l) { return s + l.adet; }, 0); }

  function renderCart() {
    clean(); save();
    var list = $('[data-cart-list]');
    var ls = lines();
    $('[data-cart-empty]').hidden = ls.length > 0;
    $('[data-cart-totals]').hidden = ls.length === 0;
    list.innerHTML = ls.map(function (l) {
      return '<li class="cart-row" data-kod="' + esc(l.p.kod) + '">' +
        '<img src="' + esc(l.p.gorsel || '/img/placeholder.svg') + '" alt="" width="64" height="48">' +
        '<div class="cr-name"><strong>' + esc(l.p.ad) + '</strong><span>' + money(l.p.fiyat) + '</span></div>' +
        '<div class="qty qty-sm"><button type="button" data-c-dec aria-label="Azalt">−</button>' +
        '<input type="number" min="1" max="' + MAX + '" value="' + l.adet + '" aria-label="' + esc(l.p.ad) + ' adet" data-c-qty>' +
        '<button type="button" data-c-inc aria-label="Artır">+</button></div>' +
        '<strong class="cr-total">' + money(l.p.fiyat * l.adet) + '</strong>' +
        '<button type="button" class="cr-remove" data-c-remove aria-label="' + esc(l.p.ad) + ' ürününü sepetten çıkar">×</button>' +
        '</li>';
    }).join('');
    var sub = subtotal();
    $('[data-subtotal]').textContent = money(sub);
    $('[data-total]').textContent = money(sub + (ls.length ? DATA.kargoUcreti : 0));
    var n = count();
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; el.hidden = n === 0; });
    var sec = $('.sec-cart .step-head p');
    if (!sec) {
      var h = $('.sec-cart .step-head div');
      sec = document.createElement('p'); h.appendChild(sec);
    }
    sec.textContent = n ? n + ' ürün' : '';
  }

  function setQty(kod, q) {
    q = parseInt(q, 10);
    if (!(q > 0)) delete cart[kod]; else cart[kod] = Math.min(q, MAX);
    renderCart();
  }

  var toastTimer;
  function toast(msg) {
    var t = $('[data-toast]');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  // Ürün kartları
  $$('[data-product]').forEach(function (card) {
    var kod = card.getAttribute('data-product');
    var input = $('input', card);
    var norm = function () { var v = parseInt(input.value, 10); input.value = Math.max(1, Math.min(MAX, v > 0 ? v : 1)); };
    $('[data-dec]', card).addEventListener('click', function () { input.value = (parseInt(input.value, 10) || 1) - 1; norm(); });
    $('[data-inc]', card).addEventListener('click', function () { input.value = (parseInt(input.value, 10) || 1) + 1; norm(); });
    input.addEventListener('change', norm);
    $('[data-add]', card).addEventListener('click', function () {
      norm();
      var add = parseInt(input.value, 10);
      var before = cart[kod] || 0;
      cart[kod] = Math.min(before + add, MAX);
      renderCart();
      input.value = 1;
      toast(cart[kod] === MAX && before + add > MAX
        ? 'Bir üründen en fazla ' + MAX + ' adet alınabilir.'
        : products[kod].ad + ' sepete eklendi.');
    });
  });

  // Sepet satırları
  var list = $('[data-cart-list]');
  list.addEventListener('click', function (e) {
    var row = e.target.closest('[data-kod]'); if (!row) return;
    var kod = row.getAttribute('data-kod');
    if (e.target.closest('[data-c-inc]')) setQty(kod, (cart[kod] || 0) + 1);
    else if (e.target.closest('[data-c-dec]')) { if (cart[kod] > 1) setQty(kod, cart[kod] - 1); }
    else if (e.target.closest('[data-c-remove]')) { setQty(kod, 0); toast('Ürün sepetten çıkarıldı.'); }
  });
  list.addEventListener('change', function (e) {
    if (!e.target.matches('[data-c-qty]')) return;
    var kod = e.target.closest('[data-kod]').getAttribute('data-kod');
    setQty(kod, Math.max(1, parseInt(e.target.value, 10) || 1));
  });

  // ---------- Form doğrulama (sunucu da aynı kontrolleri yapar) ----------
  var form = $('#siparis-formu');
  var NAME_RE = /^[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû][A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû\s.'-]*$/;
  function cleanPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    var m = d.match(/^(?:90|0)?(5\d{9})$/);
    return m ? '0' + m[1] : null;
  }
  function values() {
    var f = new FormData(form);
    var o = {};
    ['ad', 'soyad', 'telefon', 'eposta', 'il', 'ilce', 'mahalle', 'adres', 'postaKodu', 'not', 'odemeYontemi', 'website']
      .forEach(function (k) { o[k] = String(f.get(k) || '').trim(); });
    o.onay = f.get('onay') === '1';
    return o;
  }
  function validate(v) {
    var e = {};
    if (v.ad.length < 2 || !NAME_RE.test(v.ad)) e.ad = 'Adınızı yazın.';
    if (v.soyad.length < 2 || !NAME_RE.test(v.soyad)) e.soyad = 'Soyadınızı yazın.';
    if (!cleanPhone(v.telefon)) e.telefon = 'Geçerli bir cep telefonu numarası yazın (örnek: 0532 123 45 67).';
    if (v.eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.eposta)) e.eposta = 'E-posta adresi geçersiz görünüyor.';
    if (!v.il) e.il = 'İl seçin.';
    if (v.ilce.length < 2) e.ilce = 'İlçe yazın.';
    if (v.mahalle.length < 2) e.mahalle = 'Mahalle yazın.';
    if (v.adres.length < 10) e.adres = 'Sokak, bina ve daire numarasıyla açık adresinizi yazın.';
    if (v.postaKodu && !/^\d{5}$/.test(v.postaKodu)) e.postaKodu = 'Posta kodu 5 rakam olmalı.';
    if (!v.odemeYontemi) e.odeme = 'Ödeme yöntemi seçin.';
    if (!v.onay) e.onay = 'Devam etmek için mesafeli satış sözleşmesini onaylayın.';
    return e;
  }
  function showErrors(errs) {
    $$('[data-field]').forEach(function (f) { f.classList.remove('has-err'); });
    $$('.err').forEach(function (el) { el.textContent = ''; });
    var alertBox = $('[data-form-alert]');
    alertBox.hidden = true;
    var first = null;
    Object.keys(errs).forEach(function (k) {
      var el = document.getElementById('e-' + k);
      if (el) {
        el.textContent = errs[k];
        var f = el.closest('[data-field]'); if (f) f.classList.add('has-err');
        if (!first) first = f;
      }
    });
    var general = [errs.sepet, errs.genel].filter(Boolean);
    if (general.length) { alertBox.textContent = general.join(' '); alertBox.hidden = false; if (!first) first = alertBox; }
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var inp = $('input,select,textarea', first); if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 300);
    }
  }
  form.addEventListener('input', function (e) {
    var f = e.target.closest('[data-field]');
    if (f && f.classList.contains('has-err')) { f.classList.remove('has-err'); var er = $('.err', f); if (er) er.textContent = ''; }
  });
  // Telefon: yalnızca rakam ve boşluk
  $('#f-telefon').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/[^\d\s+()-]/g, ''); });
  $('#f-postaKodu').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); });

  // ---------- Onay penceresi ve gönderim ----------
  var dialog = $('#onay-penceresi');
  var sending = false;
  function orderKey() {
    var k = store(ORDER_KEY);
    if (!k) {
      k = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      store(ORDER_KEY, k);
    }
    return k;
  }
  function summaryHtml(items, sub, ship, total, d, payName) {
    return '<table class="sum-table"><thead><tr><th>Ürün</th><th>Adet</th><th>Tutar</th></tr></thead><tbody>' +
      items.map(function (i) { return '<tr><td>' + esc(i.ad) + '</td><td>' + i.adet + '</td><td>' + money(i.tutar) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="2">Ara toplam</td><td>' + money(sub) + '</td></tr>' +
      '<tr><td colspan="2">Kargo</td><td>' + (ship ? money(ship) : 'Ücretsiz') + '</td></tr>' +
      '<tr class="grand"><td colspan="2">Toplam</td><td>' + money(total) + '</td></tr></tfoot></table>' +
      '<div class="sum-addr"><strong>Teslimat adresi</strong><p>' + esc(d.adSoyad) + ' · ' + esc(d.telefon) + '<br>' +
      esc(d.adres) + '<br>' + esc(d.mahalle) + ' Mah., ' + esc(d.ilce) + ' / ' + esc(d.il) + (d.postaKodu ? ' ' + esc(d.postaKodu) : '') + '</p></div>' +
      '<p class="sum-pay"><strong>Ödeme:</strong> ' + esc(payName) + '</p>';
  }
  function payName(kod) {
    var m = DATA.odeme.filter(function (o) { return o.kod === kod; })[0];
    return m ? m.ad : kod;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var v = values();
    var errs = validate(v);
    if (!count()) errs.sepet = 'Sepetiniz boş. Sipariş vermek için önce ürün ekleyin.';
    if (Object.keys(errs).length) { showErrors(errs); return; }
    showErrors({});
    var ls = lines();
    var items = ls.map(function (l) { return { ad: l.p.ad, adet: l.adet, tutar: l.p.fiyat * l.adet }; });
    var sub = subtotal();
    $('[data-confirm-body]').innerHTML = summaryHtml(items, sub, DATA.kargoUcreti, sub + DATA.kargoUcreti, {
      adSoyad: v.ad + ' ' + v.soyad, telefon: cleanPhone(v.telefon), adres: v.adres, mahalle: v.mahalle, ilce: v.ilce, il: v.il, postaKodu: v.postaKodu,
    }, payName(v.odemeYontemi));
    $('[data-confirm-alert]').hidden = true;
    if (dialog.showModal) dialog.showModal(); else if (window.confirm('Siparişi onaylıyor musunuz?')) send();
  });

  $('[data-confirm-ok]').addEventListener('click', function (e) { e.preventDefault(); send(); });
  $('[data-confirm-cancel]').addEventListener('click', function (e) { e.preventDefault(); if (!sending) dialog.close(); });
  dialog.addEventListener('cancel', function (e) { if (sending) e.preventDefault(); });

  function setSending(on) {
    sending = on;
    var ok = $('[data-confirm-ok]');
    ok.disabled = on; $('[data-confirm-cancel]').disabled = on; $('[data-submit]').disabled = on;
    ok.lastChild.textContent = on ? ' Gönderiliyor…' : ' Onayla ve Siparişi Ver';
  }

  function send() {
    if (sending) return;
    var v = values();
    var payload = {
      sepet: lines().map(function (l) { return { kod: l.p.kod, adet: l.adet }; }),
      ad: v.ad, soyad: v.soyad, telefon: v.telefon, eposta: v.eposta, il: v.il, ilce: v.ilce, mahalle: v.mahalle,
      adres: v.adres, postaKodu: v.postaKodu, not: v.not, odemeYontemi: v.odemeYontemi, onay: v.onay,
      website: v.website, anahtar: orderKey(),
    };
    setSending(true);
    fetch('/api/siparis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin',
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, errors: { genel: 'Beklenmeyen bir yanıt alındı. Lütfen tekrar deneyin.' } }; });
    }).then(function (res) {
      setSending(false);
      if (!res.ok) {
        var errs = res.errors || { genel: 'Sipariş gönderilemedi. Lütfen tekrar deneyin.' };
        var onlyGeneral = Object.keys(errs).every(function (k) { return k === 'genel'; });
        if (onlyGeneral) { var a = $('[data-confirm-alert]'); a.textContent = errs.genel; a.hidden = false; return; }
        dialog.close(); showErrors(errs); return;
      }
      dialog.close();
      done(res);
    }).catch(function () {
      setSending(false);
      var a = $('[data-confirm-alert]');
      a.textContent = 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin; siparişiniz iki kez kaydedilmez.';
      a.hidden = false;
    });
  }

  function done(res) {
    cart = {}; save(); store(ORDER_KEY, null);
    renderCart();
    var o = res.ozet;
    $('[data-done-no]').textContent = res.siparisNo;
    $('[data-done-summary]').innerHTML = summaryHtml(o.urunler, o.araToplam, o.kargo, o.toplam, o.teslimat, payName(o.odeme));
    form.reset();
    form.hidden = true;
    $('.sec-cart').hidden = true;
    $('.sec-products').hidden = true;
    $('#tamamlandi').hidden = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Reklam linkinden gelen ürünü öne çıkar
  if (DATA.vurgula) {
    var c = document.getElementById('urun-' + DATA.vurgula);
    if (c) { c.classList.add('highlight'); setTimeout(function () { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200); }
  }

  renderCart();
})();
