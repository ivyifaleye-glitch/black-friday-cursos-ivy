const crypto = require('node:crypto');
const ORIGINS = new Set(['https://escolaivyifaleye.com.br', 'https://www.escolaivyifaleye.com.br']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const normalizeName = value => String(value || '').trim().split(/\s+/)[0].toLowerCase();
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^(?:[1-9]\d{9,10})$/.test(digits) ? '55' + digits : digits;
}
const validEventId = value => typeof value === 'string' && /^lead_\d{13}_[a-z0-9]{6,20}$/.test(value);
function signature(data, secret, expires) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify([
    data.event_id, normalizeEmail(data.email), normalizePhone(data.phone), normalizeName(data.first_name), expires
  ])).digest('hex');
}
function issueReceipt(data, secret, now = Date.now()) {
  if (!secret || !validEventId(data.event_id)) return null;
  const expires = now + 5 * 60 * 1000;
  return { expires, signature: signature(data, secret, expires) };
}
function validReceipt(data, secret, now = Date.now()) {
  const r = data.receipt;
  if (!secret || !r || !Number.isSafeInteger(r.expires) || r.expires < now || r.expires > now + 5 * 60 * 1000 || !/^[a-f0-9]{64}$/.test(r.signature || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(r.signature, 'hex'), Buffer.from(signature(data, secret, r.expires), 'hex'));
}
module.exports = { ORIGINS, hash, normalizeEmail, normalizePhone, normalizeName, validEventId, issueReceipt, validReceipt };
