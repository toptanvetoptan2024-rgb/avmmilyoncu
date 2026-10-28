// Küçük HTML şablon yardımcısı. Değerler otomatik olarak güvenli hale getirilir (XSS koruması).

class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escape(v) {
  return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

function render(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return escape(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Safe(out);
}

// Sadece güvenilir, kodun kendi ürettiği metin için.
export function raw(s) {
  return new Safe(String(s));
}
