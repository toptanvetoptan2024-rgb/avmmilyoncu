(function () {
  var IL = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Şanlıurfa','Siirt','Sinop','Sivas','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak','Yurt dışı'];

  function kur() {
    var form = document.getElementById('tvt-bv-form');
    if (!form || form.getAttribute('data-hazir')) return;
    form.setAttribute('data-hazir', '1');

    // Şehir listeleri
    var sel = form.querySelectorAll('select[data-il]');
    for (var i = 0; i < sel.length; i++) {
      var h = '<option value="">Şehir seçiniz</option>';
      for (var j = 0; j < IL.length; j++) h += '<option>' + IL[j] + '</option>';
      sel[i].innerHTML = h;
    }

    // Türe göre ek alanları göster (eski tarayıcılar için de)
    function goster() {
      var secili = form.querySelector('input[name="subject"]:checked');
      var tur = secili ? secili.parentNode.getAttribute('data-tur') : '';
      var ekler = form.querySelectorAll('.bv-ek');
      for (var k = 0; k < ekler.length; k++) {
        ekler[k].className = ekler[k].className.replace(/\s?on\b/g, '') + (ekler[k].getAttribute('data-ek') === tur ? ' on' : '');
      }
      hataYaz(form.querySelector('[data-err="subject"]'), '');
    }
    var radyo = form.querySelectorAll('input[name="subject"]');
    for (var r = 0; r < radyo.length; r++) radyo[r].addEventListener('change', goster);

    // Bağlantıdan tür seçimi: ?tur=yatirimci gibi
    var m = /[?&]tur=([a-z]+)/.exec(location.search);
    if (m && document.getElementById('tvt-t-' + m[1])) document.getElementById('tvt-t-' + m[1]).checked = true;
    goster();

    // Karakter sayacı
    var detay = document.getElementById('tvt-detay');
    var sayac = form.querySelector('[data-count]');
    detay.addEventListener('input', function () { sayac.textContent = detay.value.length; });

    // Yazmaya başlayınca hatayı temizle
    form.addEventListener('input', function (e) {
      if (e.target.classList && e.target.classList.contains('err')) alanHata(e.target, '');
    });
  }

  function hataYaz(el, msg) { if (el) el.textContent = msg; }
  function alanHata(alan, msg) {
    if (msg) alan.classList.add('err'); else alan.classList.remove('err');
    var k = alan.parentNode.querySelector('.bv-msg') || (alan.parentNode.parentNode && alan.parentNode.parentNode.querySelector('.bv-msg'));
    hataYaz(k, msg);
  }
  function temiz(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function telefon(v) {
    var d = String(v || '').replace(/\D/g, '');
    var m = d.match(/^(?:90|0)?(5\d{9})$/);
    return m ? '0' + m[1].replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4') : '';
  }

  window.tvtBasvuruGonder = function (form) {
    if (form.tvt_web && form.tvt_web.value) return false; // bot tuzağı
    var ilk = null, i;
    function hata(alan, msg) { alanHata(alan, msg); if (!ilk) ilk = alan; }

    var secili = form.querySelector('input[name="subject"]:checked');
    hataYaz(form.querySelector('[data-err="subject"]'), secili ? '' : 'Lütfen başvuru türünü seçiniz.');
    if (!secili) ilk = form.querySelector('.bv-types');

    // Ek alanlar (yalnızca seçilen tür)
    var satirlar = [];
    if (secili) {
      var tur = secili.parentNode.getAttribute('data-tur');
      var ek = form.querySelectorAll('.bv-ek[data-ek="' + tur + '"] .bv-c');
      for (i = 0; i < ek.length; i++) {
        var v = ek[i].tagName === 'TEXTAREA' ? String(ek[i].value || '').trim() : temiz(ek[i].value);
        if (ek[i].getAttribute('data-req') && v.length < 2) hata(ek[i], 'Bu alanı doldurunuz.');
        else alanHata(ek[i], '');
        if (v) satirlar.push(ek[i].getAttribute('data-label') + ': ' + v);
      }
    }

    var ad = form.name, tel = form.phone, ep = form.email, dt = document.getElementById('tvt-detay');
    ad.value = temiz(ad.value);
    if (ad.value.length < 5 || ad.value.indexOf(' ') < 0) hata(ad, 'Adınızı ve soyadınızı yazınız.'); else alanHata(ad, '');
    var t = telefon(tel.value);
    if (!t) hata(tel, 'Geçerli bir cep telefonu yazınız (örnek: 0532 123 45 67).'); else { tel.value = t; alanHata(tel, ''); }
    ep.value = temiz(ep.value).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ep.value)) hata(ep, 'Geçerli bir e-posta adresi yazınız.'); else alanHata(ep, '');
    var detay = String(dt.value || '').trim();
    if (detay.length < 10) hata(dt, 'Başvurunuz hakkında kısa bir açıklama yazınız.'); else alanHata(dt, '');
    var onay = form.tvt_onay.checked;
    hataYaz(form.querySelector('[data-err="onay"]'), onay ? '' : 'Devam etmek için onay kutusunu işaretleyiniz.');
    if (!onay && !ilk) ilk = form.tvt_onay;

    if (ilk) {
      if (ilk.scrollIntoView) ilk.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (ilk.focus) try { ilk.focus({ preventScroll: true }); } catch (e) { ilk.focus(); }
      return false;
    }

    // Panelde tek mesaj olarak okunacak düzenli metin
    form.message.value =
      'BAŞVURU TÜRÜ: ' + secili.value + '\n' +
      'Ad Soyad: ' + ad.value + '\nTelefon: ' + tel.value + '\nE-Posta: ' + ep.value + '\n' +
      (satirlar.length ? '\n--- Ek Bilgiler ---\n' + satirlar.join('\n') + '\n' : '') +
      '\n--- Başvuru Detayı ---\n' + detay +
      '\n\n(KVKK onayı verildi)';

    if (typeof window.contactForm === 'function') return window.contactForm(form);
    return true;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kur); else kur();
})();
