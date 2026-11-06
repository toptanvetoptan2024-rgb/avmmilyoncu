/* 1) Vitrin adet kutusu + KDV Dahil etiketi */
(function () {
  var EN_FAZLA = 999; // en fazla adet

  function duzelt(inp) {
    var v = parseInt(inp.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > EN_FAZLA) v = EN_FAZLA;
    inp.value = v;
    return v;
  }

  function kutuOlustur() {
    var d = document.createElement('div');
    d.className = 'vq-adet';
    d.innerHTML = '<div class="vq-kutu">' +
      '<button type="button" class="vq-eksi" aria-label="Azalt">&minus;</button>' +
      '<input type="number" inputmode="numeric" min="1" max="999" value="1" aria-label="Adet">' +
      '<button type="button" class="vq-arti" aria-label="Arttır">+</button>' +
      '</div><span class="vq-etiket">Adet</span>';
    return d;
  }

  // Vitrindeki her ürün kartına KDV etiketi ve adet kutusu ekler
  function kur() {
    var kartlar = document.querySelectorAll('.card-product');
    for (var i = 0; i < kartlar.length; i++) {
      var kart = kartlar[i];
      if (kart.getAttribute('data-vq')) continue;
      kart.setAttribute('data-vq', '1');

      var fiyat = kart.querySelector('.price-group');
      if (fiyat && !kart.querySelector('.vq-kdv')) {
        var kdv = document.createElement('div');
        kdv.className = 'vq-kdv-satir';
        kdv.innerHTML = '<span class="vq-kdv">KDV Dahil</span>';
        fiyat.parentNode.insertBefore(kdv, fiyat.nextSibling);
      }

      var btn = kart.querySelector('.buttons .btn-cart');
      if (!btn || btn.classList.contains('disabled')) continue; // Stokta Yok
      if (kart.querySelector('.vq-adet')) continue;
      var butonlar = btn.closest('.buttons');
      butonlar.parentNode.insertBefore(kutuOlustur(), butonlar);
    }
  }

  // Sitenin önceki sepet isteği bitene kadar bekler, sonra devam eder
  function bekle(sonra) {
    var basla = Date.now();
    (function kontrol() {
      var mesgul = window.jQuery && window.jQuery.active > 0;
      if (mesgul && Date.now() - basla < 8000) { setTimeout(kontrol, 150); return; }
      setTimeout(sonra, 250);
    })();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;

    // + / - ve kutu tıklamaları
    var kutu = t.closest('.vq-adet');
    if (kutu) {
      e.preventDefault(); e.stopPropagation();
      var inp = kutu.querySelector('input');
      var v = duzelt(inp);
      if (t.closest('.vq-arti')) inp.value = Math.min(v + 1, EN_FAZLA);
      else if (t.closest('.vq-eksi')) inp.value = Math.max(v - 1, 1);
      else inp.focus();
      return;
    }

    // Sepete Ekle: ilk adedi sitenin kendi butonu ekler, kalanları biz ekleriz
    var btn = t.closest('.card-product .btn-cart');
    if (!btn || btn.classList.contains('disabled') || btn._vqCalisiyor) return;
    var adetInp = btn.closest('.card-product').querySelector('.vq-adet input');
    if (!adetInp) return;
    var eslesme = (btn.getAttribute('onclick') || '').match(/addCart\(\s*(\d+)/);
    if (!eslesme || typeof window.addCart !== 'function') return;
    var urunId = parseInt(eslesme[1], 10);
    var kalan = duzelt(adetInp) - 1;
    if (kalan <= 0) return;

    btn._vqCalisiyor = true;
    setTimeout(function sonraki() {
      bekle(function () {
        if (kalan <= 0) { btn._vqCalisiyor = false; return; }
        kalan--;
        window.addCart(urunId, 'card');
        setTimeout(sonraki, 300);
      });
    }, 300);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('.vq-adet')) { e.preventDefault(); duzelt(e.target); }
  }, true);
  document.addEventListener('focusout', function (e) {
    if (e.target.tagName === 'INPUT' && e.target.closest('.vq-adet')) duzelt(e.target);
  }, true);

  var zaman;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kur); else kur();
  new MutationObserver(function () { clearTimeout(zaman); zaman = setTimeout(kur, 300); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();


/* 2) Sepetteki indirimli fiyat (isteğe bağlı – panelde aynı oranda kampanya şart) */
(function () {
  // SEPETTEKİ İNDİRİM ORANI (yüzde). Qukasoft panelinde aynı oranda kampanya tanımlı olmalı!
  var ORAN = 15;

  function sayiyaCevir(yazi) {
    var t = (yazi || '').replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(t);
  }
  function fiyatYaz(s) {
    return s.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  }

  function indirimKur() {
    if (!(ORAN > 0 && ORAN < 100)) return;
    var kartlar = document.querySelectorAll('.card-product');
    for (var i = 0; i < kartlar.length; i++) {
      var kart = kartlar[i];
      if (kart.getAttribute('data-vqi')) continue;
      kart.setAttribute('data-vqi', '1');
      var fiyatlar = kart.querySelector('.price-group .prices');
      var satis = kart.querySelector('.price-group .sale-price');
      if (!fiyatlar || !satis || kart.querySelector('.vq-sepet')) continue;
      // Tema zaten indirim gösteriyorsa (birden fazla fiyat varsa) dokunma
      if (fiyatlar.children.length > 1) continue;
      var fiyat = sayiyaCevir(satis.textContent);
      if (!(fiyat > 0)) continue;
      var indirimli = Math.round(fiyat * (100 - ORAN)) / 100;
      satis.classList.add('vq-eski');
      var kutu = document.createElement('div');
      kutu.className = 'vq-sepet';
      kutu.innerHTML = '<div class="vq-sepet-yazi">Sepetteki Fiyat</div><div class="vq-sepet-fiyat">' + fiyatYaz(indirimli) + '</div>';
      fiyatlar.parentNode.insertBefore(kutu, fiyatlar.nextSibling);
    }
  }

  var zaman;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indirimKur); else indirimKur();
  new MutationObserver(function () { clearTimeout(zaman); zaman = setTimeout(indirimKur, 300); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
