# toptanvetoptan.com – İş Ortaklığı Başvuru Sayfası Kurulumu

Bu klasör AVM Milyoncu sitesinin parçası değildir. toptanvetoptan.com Qukasoft altyapısında
çalıştığı için sayfa, Qukasoft panelindeki içerik sayfasına yapıştırılarak kurulur.

## Adımlar
1. Qukasoft yönetim paneline girin.
2. İçerik / Sayfalar bölümünden **"İş Ortaklığı Başvurusu"** sayfasını açın.
3. İçerik düzenleyicide **Kaynak (HTML / `< >`)** moduna geçin.
4. İçindeki eski kodu silin (önce bir yere yedekleyin).
5. `is-ortakligi-basvurusu.html` dosyasının **tamamını** yapıştırıp kaydedin.
6. Sayfayı telefonda ve bilgisayarda açıp bir deneme başvurusu gönderin.
7. Panelde iletişim/talep mesajlarına düştüğünü kontrol edin.

## Notlar
- Form, sitenin kendi `contactForm` gönderimini kullanır. Seçilen tür "Konu" olarak,
  ek alanlar ve açıklama tek düzenli mesaj olarak panele gider.
- Panel `<script>` etiketini siliyorsa: dosyanın en altındaki `<script>...</script>` bölümünü
  Qukasoft'ta tema/alt bilgi (footer) özel kod alanına ekleyin. Kod yalnızca bu formun bulunduğu
  sayfada çalışır.
- Bağlantıyla tür seçili açmak için: `/is-ortakligi-basvurusu?tur=yatirimci`
  (dukkan, cin, yatirimci, teklif, uretici).
- "6.000+ Ürün Çeşidi" ifadesi tasarımdan alınmıştır; sayı güncel değilse metinden düzeltin.
- `onizleme.html` yalnızca deneme içindir, siteye yüklenmez.
