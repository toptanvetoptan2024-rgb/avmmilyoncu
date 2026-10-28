const config = require('./src/config');
const { open } = require('./src/db');
const { createApp } = require('./src/app');

if (config.adminPassword === 'degistir-beni') {
  console.warn('UYARI: ADMIN_PASSWORD ayarlanmadı. Canlıya almadan önce mutlaka değiştirin.');
}
if (config.paymentMode === 'test') {
  console.log('Ödeme modu: TEST (kartla ödeme simülasyon, gerçek para çekilmez)');
}

const db = open();
const app = createApp(db);
app.listen(config.port, () => {
  console.log(`AVM Milyoncu çalışıyor: http://localhost:${config.port}`);
});
