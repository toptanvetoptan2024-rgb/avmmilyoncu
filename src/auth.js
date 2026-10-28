import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

// Basit, imzalı çerezle yönetici oturumu (Web Crypto ile).
const COOKIE = 'avm_admin';
const MAX_AGE = 7 * 24 * 3600; // saniye
const enc = new TextEncoder();

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Zamanlamaya karşı güvenli karşılaştırma: iki değerin özetini karşılaştırır.
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const x = new Uint8Array(ha); const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function isAdmin(c, secret) {
  if (!secret) return false;
  const raw = getCookie(c, COOKIE);
  if (!raw) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

export async function login(c, secret) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  setCookie(c, COOKIE, `${exp}.${await hmac(secret, exp)}`, {
    httpOnly: true, sameSite: 'Strict', secure: new URL(c.req.url).protocol === 'https:', maxAge: MAX_AGE, path: '/',
  });
}

export function logout(c) {
  deleteCookie(c, COOKIE, { path: '/' });
}
