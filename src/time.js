// Türkiye saatine göre tarih yardımcıları. Veritabanı UTC tutar.
export const TZ_OFFSET = '+3 hours'; // Türkiye 2016'dan beri sabit UTC+3

export function todayTR(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
}

export function daysAgoTR(n) {
  return todayTR(new Date(Date.now() - n * 86400000));
}

// Türkiye saatiyle gün sonuna (23:59:59) kalan saniye. Kampanya sayacı bunu kullanır.
export function secondsToEndOfDayTR(now = Date.now()) {
  const trMs = now + 3 * 3600000; // UTC+3
  const passed = Math.floor((trMs % 86400000) / 1000);
  return 86400 - passed;
}

export function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function formatDateTime(utc) {
  if (!utc) return '';
  const d = new Date(String(utc).replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short',
  }).format(d);
}
