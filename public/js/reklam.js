/* AVM Milyoncu – reklam pikselleri (Meta, TikTok, Google).
 * Pikseller YALNIZCA ziyaretçi "Kabul et" derse yüklenir (KVKK çerez onayı).
 * Piksellere ad, telefon, adres gibi kişisel bilgiler GÖNDERİLMEZ; yalnızca ürün kodu, adet ve tutar gönderilir.
 * Olaylar magaza.js tarafından window.avmOlaylar kuyruğuna eklenir. */
(function () {
  'use strict';
  var A = JSON.parse(document.getElementById('reklam-ayarlari').textContent || '{}');
  var KEY = 'avm_cerez_onayi';
  var loaded = false;
  var pending = [];

  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* yoksay */ } }
  function addScript(src) {
    var s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s);
  }

  function load() {
    if (loaded) return;
    loaded = true;
    if (A.meta) {
      var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!window._fbq) window._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      addScript('https://connect.facebook.net/tr_TR/fbevents.js');
      window.fbq('init', A.meta);
      window.fbq('track', 'PageView');
    }
    if (A.tiktok) {
      var ttq = window.ttq = window.ttq || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
      ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (t) { for (var e = ttq._i[t] || [], k = 0; k < ttq.methods.length; k++) ttq.setAndDefer(e, ttq.methods[k]); return e; };
      ttq.load = function (e, o) {
        var r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
        ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = o || {};
        addScript(r + '?sdkid=' + encodeURIComponent(e) + '&lib=ttq');
      };
      ttq.load(A.tiktok);
      ttq.page();
    }
    if (A.google) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', A.google);
      addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(A.google));
    }
    pending.forEach(send);
    pending = [];
  }

  // Olay adları: urun_gor, sepete_ekle, odeme_baslat, satin_al
  var META = { urun_gor: 'ViewContent', sepete_ekle: 'AddToCart', odeme_baslat: 'InitiateCheckout', satin_al: 'Purchase' };
  var TIKTOK = { urun_gor: 'ViewContent', sepete_ekle: 'AddToCart', odeme_baslat: 'InitiateCheckout', satin_al: 'CompletePayment' };
  var GOOGLE = { urun_gor: 'view_item', sepete_ekle: 'add_to_cart', odeme_baslat: 'begin_checkout', satin_al: 'purchase' };

  function send(ev) {
    var v = ev.veri || {};
    var items = v.urunler || [];
    var value = Math.round(v.tutar || 0) / 100;
    var ids = items.map(function (u) { return u.kod; });
    var qty = items.reduce(function (s, u) { return s + (u.adet || 1); }, 0);
    var opts = v.siparisNo ? { eventID: v.siparisNo } : undefined;
    try {
      if (A.meta && window.fbq && META[ev.ad]) {
        window.fbq('track', META[ev.ad], { content_ids: ids, content_type: 'product', value: value, currency: 'TRY', num_items: qty }, opts);
      }
      if (A.tiktok && window.ttq && TIKTOK[ev.ad]) {
        window.ttq.track(TIKTOK[ev.ad], {
          contents: items.map(function (u) { return { content_id: u.kod, content_name: u.ad, quantity: u.adet || 1, price: (u.fiyat || 0) / 100 }; }),
          content_type: 'product', value: value, currency: 'TRY',
        }, v.siparisNo ? { event_id: v.siparisNo } : undefined);
      }
      if (A.google && window.gtag && GOOGLE[ev.ad]) {
        var g = {
          currency: 'TRY', value: value,
          items: items.map(function (u) { return { item_id: u.kod, item_name: u.ad, quantity: u.adet || 1, price: (u.fiyat || 0) / 100 }; }),
        };
        if (v.siparisNo) g.transaction_id = v.siparisNo;
        window.gtag('event', GOOGLE[ev.ad], g);
      }
    } catch (e) { /* reklam hatası alışverişi etkilemesin */ }
  }

  function handle(ev) {
    var choice = getChoice();
    if (choice === 'hayir') return;
    if (loaded) send(ev); else pending.push(ev);
  }

  // magaza.js'in daha önce eklediği olayları al, sonrakileri doğrudan işle
  var q = window.avmOlaylar || [];
  window.avmOlaylar = { push: handle };
  q.forEach(handle);

  // Çerez onay kutusu
  var box = document.querySelector('[data-cerez]');
  function show() { if (box) box.hidden = false; }
  function hide() { if (box) box.hidden = true; }
  if (box) {
    box.querySelector('[data-cerez-kabul]').addEventListener('click', function () { setChoice('evet'); hide(); load(); });
    box.querySelector('[data-cerez-red]').addEventListener('click', function () { setChoice('hayir'); hide(); pending = []; });
  }
  var again = document.querySelector('[data-cerez-ac]');
  if (again) again.addEventListener('click', function (e) { e.preventDefault(); show(); });

  var choice = getChoice();
  if (choice === 'evet') load();
  else if (choice !== 'hayir') show();
})();
