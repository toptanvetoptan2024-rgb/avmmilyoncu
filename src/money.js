// Tüm tutarlar veritabanında kuruş (tam sayı) olarak tutulur.

const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

function formatTRY(kurus) {
  return fmt.format((Number(kurus) || 0) / 100);
}

// "1.299,90", "1299.90", "1299" gibi girdileri kuruşa çevirir.
function parseTRY(input) {
  if (input === undefined || input === null) return null;
  let s = String(input).trim().replace(/[₺\sTL]/gi, '');
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Form alanlarında gösterim için: 129990 -> "1299,90"
function toInput(kurus) {
  if (kurus === null || kurus === undefined) return '';
  return (kurus / 100).toFixed(2).replace('.', ',');
}

module.exports = { formatTRY, parseTRY, toInput };
