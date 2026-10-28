const config = require('./config');

// Ödeme katmanı. Gerçek sağlayıcı (iyzico, PayTR vb.) eklenene kadar
// kartla ödeme yalnızca TEST modunda, simülasyon olarak çalışır.
//
// Gerçek entegrasyon eklerken:
//  1. Sağlayıcının sandbox/test anahtarlarıyla PAYMENT_MODE=test iken deneyin.
//  2. `providers.live` içine startCardPayment ve callback doğrulamasını yazın.
//  3. Ancak tüm testler başarılı olduktan sonra PAYMENT_MODE=live yapın.

const providers = {
  test: {
    name: 'Test ödeme (simülasyon)',
    startCardPayment(order) {
      return { redirect: `/odeme/test/${order.order_no}` };
    },
  },
  live: null, // Henüz bağlanmadı.
};

function cardAvailable() {
  return Boolean(providers[config.paymentMode]);
}

function availableMethods() {
  const m = { kapida: config.paymentMethods.kapida };
  if (cardAvailable()) m.kart = config.paymentMethods.kart + (config.paymentMode === 'test' ? ' (TEST)' : '');
  return m;
}

// Siparişten sonra müşterinin yönlendirileceği adres.
function start(order) {
  if (order.payment_method === 'kapida') return { redirect: `/siparis/${order.order_no}` };
  const provider = providers[config.paymentMode];
  if (!provider) throw new Error('Kartla ödeme sağlayıcısı yapılandırılmadı.');
  return provider.startCardPayment(order);
}

module.exports = { availableMethods, cardAvailable, start, isTestMode: () => config.paymentMode === 'test' };
