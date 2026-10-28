const path = require('path');

const root = path.join(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  siteName: 'AVM Milyoncu',
  siteUrl: process.env.SITE_URL || 'https://avmmilyoncu.com',
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'avmmilyoncu.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'data', 'uploads'),
  adminPassword: process.env.ADMIN_PASSWORD || 'degistir-beni',
  sessionSecret: process.env.SESSION_SECRET || 'gelistirme-anahtari-degistir',
  // "test": kartla ödeme simüle edilir, gerçek para çekilmez.
  // "live": gerçek ödeme sağlayıcısı gerekir (henüz bağlı değil).
  paymentMode: process.env.PAYMENT_MODE === 'live' ? 'live' : 'test',
  // Büyüme modeli: her aşamada en fazla 3 aktif ürün, toplam 9.
  stages: ['kazanan', 'potansiyel', 'test'],
  stageLabels: { kazanan: 'Kazanan', potansiyel: 'Potansiyel', test: 'Test' },
  maxPerStage: 3,
  maxActive: 9,
  adChannels: ['meta', 'tiktok', 'google', 'diger'],
  adChannelLabels: { meta: 'Meta (Facebook/Instagram)', tiktok: 'TikTok', google: 'Google', diger: 'Diğer' },
  orderStatuses: ['yeni', 'onaylandi', 'kargoda', 'teslim', 'iade', 'iptal'],
  orderStatusLabels: {
    yeni: 'Yeni', onaylandi: 'Onaylandı', kargoda: 'Kargoda',
    teslim: 'Teslim edildi', iade: 'İade', iptal: 'İptal',
  },
  // Kârlılık hesabında gelir sayılmayan durumlar.
  lostStatuses: ['iade', 'iptal'],
  paymentMethods: { kapida: 'Kapıda ödeme', kart: 'Kredi / banka kartı' },
  contact: {
    phone: process.env.CONTACT_PHONE || '0 (5xx) xxx xx xx',
    email: process.env.CONTACT_EMAIL || 'destek@avmmilyoncu.com',
    whatsapp: process.env.CONTACT_WHATSAPP || '',
  },
};
