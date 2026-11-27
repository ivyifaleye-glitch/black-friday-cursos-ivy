const { createHash } = require('node:crypto');
const LIST_ID = '375e915980';
const TAG = 'O Despertar da Erveira | Dezembro 2026';
async function registerMember({ fetchImpl, key, nome, email, phone, attribution = {} }) {
  const dc = key.match(/-(us\d+)$/)?.[1];
  if (!dc) throw new Error('mailchimp-configuration');
  const id = createHash('md5').update(email.toLowerCase()).digest('hex');
  const base = `https://${dc}.api.mailchimp.com/3.0/lists/${LIST_ID}/members/${id}`;
  const headers = { Authorization: 'Basic ' + Buffer.from('erveira:' + key).toString('base64'), 'Content-Type': 'application/json' };
  const request = async (url, method = 'GET', body) => {
    const response = await fetchImpl(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    let result = {};
    if (response.status !== 204) result = await response.json();
    return { status: response.status, ok: response.ok, result };
  };
  const existing = await request(base);
  if (!existing.ok && existing.status !== 404) throw new Error('mailchimp-unavailable');
  if (existing.ok && existing.result.status !== 'subscribed') return { ok: false, restricted: true };
  const merge_fields = { FNAME: nome.split(/\s+/)[0], PHONE: '+55' + phone };
  for (const field of ['USOURCE', 'UMEDIUM', 'UCAMPAIGN', 'UCONTENT', 'UTERM', 'FBCLID']) {
    if (typeof attribution[field] === 'string' && attribution[field].trim()) merge_fields[field] = attribution[field].trim().slice(0, 255);
  }
  const saved = await request(base, 'PUT', { email_address: email, status_if_new: 'subscribed', merge_fields });
  if (!saved.ok || saved.result.status !== 'subscribed') throw new Error('mailchimp-save');
  const tagged = await request(base + '/tags', 'POST', { tags: [{ name: TAG, status: 'active' }] });
  if (!tagged.ok) throw new Error('mailchimp-tag');
  return { ok: true };
}
module.exports = { registerMember };
