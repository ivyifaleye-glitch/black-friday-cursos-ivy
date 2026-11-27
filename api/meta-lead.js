const { ORIGINS, hash, normalizeEmail, normalizePhone, normalizeName, validEventId, validReceipt } = require('../lib/meta-utils');

function createHandler({ fetchImpl = fetch, env = process.env, logger = console, now = Date.now } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const reply = (status, body) => res.status(status).json(body);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { ok: false }); }
    if (!ORIGINS.has(req.headers.origin)) return reply(403, { ok: false });
    let data = req.body;
    try {
      if (typeof data === 'string') { if (Buffer.byteLength(data) > 8192) return reply(413, { ok: false }); data = JSON.parse(data); }
    } catch { return reply(400, { ok: false }); }
    if (!data || !validEventId(data.event_id)) return reply(400, { ok: false });
    if (!env.META_CAPI_TOKEN) return reply(200, { ok: true, sent: false });
    // A receipt is issued only after Mailchimp confirms the registration.
    if (!validReceipt(data, env.META_CAPI_TOKEN, now())) return reply(403, { ok: false });
    const email = normalizeEmail(data.email), phone = normalizePhone(data.phone), firstName = normalizeName(data.first_name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^55[1-9]\d{9,10}$/.test(phone) || !firstName) return reply(400, { ok: false });
    let source;
    try { source = new URL(data.event_source_url); if (!ORIGINS.has(source.origin)) throw Error(); source.search = ''; source.hash = ''; }
    catch { return reply(400, { ok: false }); }
    const user = { em: [hash(email)], ph: [hash(phone)], fn: [hash(firstName)], country: [hash('br')] };
    for (const key of ['fbp', 'fbc']) if (typeof data[key] === 'string' && /^fb\.\d+\.\d{13}\.[A-Za-z0-9_.-]{1,500}$/.test(data[key])) user[key] = data[key];
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
    if (ip) user.client_ip_address = ip;
    if (req.headers['user-agent']) user.client_user_agent = String(req.headers['user-agent']).slice(0, 1000);
    const payload = { data: [{ event_name: 'Lead', event_time: Math.floor(now() / 1000), event_id: data.event_id, action_source: 'website', event_source_url: source.href, user_data: user, custom_data: { content_name: 'O Despertar da Erveir@', value: 0, currency: 'BRL' } }] };
    if (env.META_TEST_EVENT_CODE) payload.test_event_code = env.META_TEST_EVENT_CODE;
    try {
      const result = await fetchImpl('https://graph.facebook.com/v27.0/954778512899267/events', { method: 'POST', headers: { Authorization: 'Bearer ' + env.META_CAPI_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) });
      const response = await result.json();
      if (!result.ok || response.events_received !== 1) { logger.error('meta-lead: evento não aceito', { status: result.status, code: response.error?.code, trace: response.fbtrace_id }); return reply(200, { ok: true, sent: false }); }
      return reply(200, { ok: true, sent: true });
    } catch { logger.error('meta-lead: falha de conexão'); return reply(200, { ok: true, sent: false }); }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
