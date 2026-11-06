(function () {
  function etiket(sinif) {
    var d = document.createElement('div');
    d.className = 'vq-kdv-satir ' + sinif;
    d.innerHTML = '<span class="vq-kdv">KDV Dahil</span>';
    return d;
  }
  function sonrasinaEkle(hedef, sinif) {
    hedef.parentNode.insertBefore(etiket(sinif), hedef.nextSibling);
  }
  // Ürün kartı içinde OLMAYAN ilk eşleşmeyi bulur (benzer ürünler hariç)
  function bul(kutu, secici) {
    var liste = kutu.querySelectorAll(secici);
    for (var i = 0; i < liste.length; i++) {
      if (!liste[i].closest('.card-product')) return liste[i];
    }
    return null;
  }

  function kur() {
    // 1) Vitrin / kategori ürün kartları
    var kartlar = document.querySelectorAll('.card-product');
    for (var i = 0; i < kartlar.length; i++) {
      var kart = kartlar[i];
      if (kart.querySelector('.vq-kdv')) continue;
      var hedef = kart.querySelector('.sale-price-basket') || kart.querySelector('.price-group');
      if (hedef) sonrasinaEkle(hedef, 'vq-kart');
    }

    // 2) Ürün detay sayfası ve hızlı bakış penceresi
    var alanlar = document.querySelectorAll('.product-profile-1, .product-profile-info, .hizli-sepet');
    for (var j = 0; j < alanlar.length; j++) {
      var alan = alanlar[j];
      if (alan.closest('.card-product') || alan.querySelector('.vq-detay')) continue;
      var h = bul(alan, '.sale-price-discount') || bul(alan, '.product-price-group') || bul(alan, '.prices');
      if (h) sonrasinaEkle(h, 'vq-detay');
    }
  }

  var zaman;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kur); else kur();
  new MutationObserver(function () { clearTimeout(zaman); zaman = setTimeout(kur, 300); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
