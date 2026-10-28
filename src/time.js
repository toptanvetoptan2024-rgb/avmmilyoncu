// Türkiye saatine göre tarih yardımcıları. Veritabanı UTC tutar.
const TZ_OFFSET = '+3 hours'; // Türkiye 2016'dan beri sabit UTC+3

function todayTR(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
}

function daysAgoTR(n) {
  return todayTR(new Date(Date.now() - n * 86400000));
}

function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

function formatDateTime(utc) {
  if (!utc) return '';
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short',
  }).format(d);
}

module.exports = { TZ_OFFSET, todayTR, daysAgoTR, isDate, formatDateTime };
