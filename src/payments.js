// Ödeme katmanı.
//
// ŞU AN: Sadece "kapıda ödeme" var. Bu seçenek magaza.json içindeki "kapidaOdeme" true yapılınca
// (ya da Cloudflare'de KAPIDA_ODEME=acik) açılır. Kart ödemesi KAPALIDIR; sitede "Yakında" olarak görünür.
//
// İLERİDE SANAL POS (iyzico, PayTR vb.) EKLEMEK İÇİN:
//  1. CARD_PROVIDER içine sağlayıcıyı yazın: startPayment(order) -> sağlayıcının güvenli ödeme sayfası adresi,
//     verifyCallback(request) -> sağlayıcının imzalı bildirimini doğrular.
//  2. Kart numarası, son kullanma tarihi ve CVV ASLA bu sitede alınmaz ve saklanmaz; müşteri sağlayıcının
//     3D Secure ödeme sayfasına yönlendirilir. Sağlayıcı anahtarları Cloudflare'de gizli değer (Secret) olarak tutulur.
//  3. Önce sağlayıcının test (sandbox) ortamında denenir, sonra canlıya alınır.

export const CARD_PROVIDER = null; // Henüz bağlı değil.

// admin: yönetim paneline giriş yapmış kişi. Yalnızca ona "Test siparişi" seçeneği gösterilir;
// bu siparişler test olarak işaretlenir, raporlara ve reklam piksellerine gitmez.
export function paymentOptions(store, { admin = false } = {}) {
  const options = [
    {
      code: 'kapida',
      title: 'Kapıda Ödeme',
      description: store.cashOnDeliveryText,
      enabled: Boolean(store.cashOnDelivery),
      note: store.cashOnDelivery ? '' : 'Şu an kapalı',
    },
    {
      code: 'kart',
      title: 'Kredi Kartı ile Öde',
      description: 'Güvenli online ödeme',
      enabled: Boolean(CARD_PROVIDER),
      note: CARD_PROVIDER ? '' : 'Yakında',
    },
  ];
  if (admin) {
    options.push({
      code: 'test', title: 'Test Siparişi', description: 'Yalnızca yönetici görür. Raporlara ve reklamlara yansımaz.',
      enabled: true, note: 'Yönetici',
    });
  }
  return options;
}

export function enabledMethods(store, opts) {
  return paymentOptions(store, opts).filter((m) => m.enabled).map((m) => m.code);
}
