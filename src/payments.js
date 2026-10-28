import { PAYMENT_METHODS } from './config.js';

// Ödeme katmanı. Gerçek sağlayıcı (iyzico, PayTR vb.) eklenene kadar
// kartla ödeme yalnızca TEST modunda, simülasyon olarak çalışır.
//
// Gerçek entegrasyon eklerken:
//  1. Sağlayıcının sandbox/test anahtarlarıyla PAYMENT_MODE=test iken deneyin.
//  2. `providers.live` içine startCardPayment ve geri dönüş doğrulamasını yazın.
//  3. Ancak tüm denemeler başarılı olduktan sonra PAYMENT_MODE=live yapın.

const providers = {
  test: {
    name: 'Test ödeme (simülasyon)',
    startCardPayment(order) {
      return { redirect: `/odeme/test/${order.order_no}` };
    },
  },
  live: null, // Henüz bağlanmadı.
};

export function paymentService(mode) {
  const provider = providers[mode];
  return {
    isTestMode: () => mode === 'test',
    availableMethods() {
      const m = { kapida: PAYMENT_METHODS.kapida };
      if (provider) m.kart = PAYMENT_METHODS.kart + (mode === 'test' ? ' (TEST)' : '');
      return m;
    },
    // Siparişten sonra müşterinin yönlendirileceği adres.
    start(order) {
      if (order.payment_method === 'kapida') return { redirect: `/siparis/${order.order_no}` };
      if (!provider) throw new Error('Kartla ödeme sağlayıcısı yapılandırılmadı.');
      return provider.startCardPayment(order);
    },
  };
}
