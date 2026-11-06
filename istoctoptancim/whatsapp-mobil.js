(function () {
  // WhatsApp numaranızı başında 90 ile, boşluksuz yazın. Örnek: 905321234567
  var TELEFON = '90XXXXXXXXXX';
  var MESAJ = 'Merhaba, istoctoptancim.com üzerinden yazıyorum.';
  var YAZI = 'Whatsapp Destek İçin Tıklayınız';

  // Ekranın en altına sabitlenmiş mobil menüyü bulur, yüksekliğini döndürür
  function altMenuYuksekligi() {
    var en = 0, w = window.innerWidth, h = window.innerHeight;
    var hepsi = document.body.getElementsByTagName('*');
    for (var i = 0; i < hepsi.length; i++) {
      var el = hepsi[i];
      if (el.closest('.vq-wp-cubuk')) continue;
      var st = window.getComputedStyle(el);
      if (st.position !== 'fixed' || st.display === 'none' || st.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (r.height <= 0 || r.height > 150 || r.width < w * 0.8) continue;
      if (Math.abs(r.bottom - h) > 3) continue;
      if (r.height > en) en = r.height;
    }
    return Math.round(en);
  }

  function yerlestir() {
    var alt = window.innerWidth <= 991 ? altMenuYuksekligi() : 0;
    document.documentElement.style.setProperty('--vq-alt', alt + 'px');
    document.documentElement.classList.toggle('vq-alt-var', alt > 0);
  }

  function kur() {
    if (document.querySelector('.vq-wp-cubuk')) return;
    var a = document.createElement('a');
    a.className = 'vq-wp-cubuk';
    a.href = 'https://wa.me/' + TELEFON + '?text=' + encodeURIComponent(MESAJ);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', YAZI);
    a.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.9-3.9-1.9-6.1C4.9 9.8 9.9 4.9 16 4.9s11.1 4.9 11.1 10.9S22.1 26.4 16 26.4zm6.1-8.1c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.7-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.5c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.1 2.9 1.1 3.5.9 4.1.9.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.7-.4z"/></svg><span>' + YAZI + '</span>';
    document.body.appendChild(a);

    yerlestir();
    // Alt menü sayfa yüklendikten biraz sonra gelebilir; birkaç kez tekrar ölç
    setTimeout(yerlestir, 500);
    setTimeout(yerlestir, 1500);
    setTimeout(yerlestir, 4000);
    var zaman;
    window.addEventListener('resize', function () { clearTimeout(zaman); zaman = setTimeout(yerlestir, 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kur); else kur();
})();
