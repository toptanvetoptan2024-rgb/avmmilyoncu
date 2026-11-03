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
export const PAYMENT_METHODS = { kapida: 'Kapıda ödeme', kart: 'Kredi kartı' };
export const PAYMENT_STATUS_LABELS = { bekliyor: 'Bekliyor', odendi: 'Ödendi', basarisiz: 'Başarısız' };

// Cloudflare panelindeki ayarlardan (değişkenler ve gizli değerler) okunan değerler.
// Şifre ve anahtarlar koda YAZILMAZ; Cloudflare'de "Gizli" (Secret) olarak eklenir.
export function runtime(env = {}) {
  return {
    adminPassword: String(env.ADMIN_PASSWORD || '').trim(),
    // Oturum imzası; şifre değişince eski oturumlar geçersiz olur.
    sessionSecret: env.SESSION_SECRET || (env.ADMIN_PASSWORD ? `avm|${String(env.ADMIN_PASSWORD).trim()}` : ''),
    siteUrl: env.SITE_URL || 'https://avmmilyoncu.com',
  };
}
