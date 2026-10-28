// Sabit iş kuralları
export const SITE_NAME = 'AVM Milyoncu';

// Büyüme modeli: her aşamada en fazla 3 aktif ürün, toplam 9.
export const STAGES = ['kazanan', 'potansiyel', 'test'];
export const STAGE_LABELS = { kazanan: 'Kazanan', potansiyel: 'Potansiyel', test: 'Test' };
export const MAX_PER_STAGE = 3;
export const MAX_ACTIVE = 9;

export const AD_CHANNELS = ['meta', 'tiktok', 'google', 'diger'];
export const AD_CHANNEL_LABELS = { meta: 'Meta (Facebook/Instagram)', tiktok: 'TikTok', google: 'Google', diger: 'Diğer' };

export const ORDER_STATUSES = ['yeni', 'onaylandi', 'kargoda', 'teslim', 'iade', 'iptal'];
export const ORDER_STATUS_LABELS = {
  yeni: 'Yeni', onaylandi: 'Onaylandı', kargoda: 'Kargoda',
  teslim: 'Teslim edildi', iade: 'İade', iptal: 'İptal',
};
// Kârlılık hesabında gelir sayılmayan durumlar.
export const LOST_STATUSES = ['iade', 'iptal'];
export const PAYMENT_METHODS = { kapida: 'Kapıda ödeme', kart: 'Kredi / banka kartı' };
export const PAYMENT_STATUS_LABELS = { bekliyor: 'Bekliyor', odendi: 'Ödendi', basarisiz: 'Başarısız' };

// GEÇİCİ başlangıç şifresi. Depo herkese açıkken bu şifreyi herkes görebilir!
// Güvenli hale getirmek için: Cloudflare'de ADMIN_PASSWORD gizli değerini ekleyin,
// ardından bu satırı boş ('') yapın.
export const TEMP_ADMIN_PASSWORD = 'Avm123';

// Cloudflare panelindeki ayarlardan (değişkenler ve gizli değerler) okunan değerler.
export function runtime(env = {}) {
  return {
    adminPassword: env.ADMIN_PASSWORD || '',
    tempPassword: TEMP_ADMIN_PASSWORD,
    // Oturum imzası; şifre değişince eski oturumlar geçersiz olur.
    sessionSecret: env.SESSION_SECRET || `${env.ADMIN_PASSWORD || ''}|${TEMP_ADMIN_PASSWORD}`,
    // "test": kartla ödeme simüle edilir, gerçek para çekilmez.
    // "live": gerçek ödeme sağlayıcısı gerekir (henüz bağlı değil).
    paymentMode: env.PAYMENT_MODE === 'live' ? 'live' : 'test',
    siteUrl: env.SITE_URL || 'https://avmmilyoncu.com',
    contact: {
      phone: env.CONTACT_PHONE || '0 (5xx) xxx xx xx',
      email: env.CONTACT_EMAIL || 'destek@avmmilyoncu.com',
      whatsapp: env.CONTACT_WHATSAPP || '',
    },
  };
}
