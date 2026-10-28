const crypto = require('crypto');
const config = require('./config');

// Basit, imzalı çerezle yönetici oturumu.
const COOKIE = 'avm_admin';
const MAX_AGE = 7 * 24 * 3600 * 1000;

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* yoksay */ }
    }
  });
  return out;
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isAdmin(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

function login(res, req) {
  const exp = String(Date.now() + MAX_AGE);
  res.cookie(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: MAX_AGE, path: '/',
  });
}

function logout(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  return res.redirect('/yonetim/giris');
}

module.exports = { isAdmin, login, logout, requireAdmin, safeEqual, parseCookies };
