const ORIGINS = new Set(['https://escolaivyifaleye.com.br', 'https://www.escolaivyifaleye.com.br']);
const FORM_URL = 'https://eco.us15.list-manage.com/subscribe/post-json?u=da6f3a2d4fd2aef20679be707&id=375e915980&f_id=00c494e0f0';
const EVENT_TAG_ID = '2341270';

function createHandler({ fetchImpl = fetch, env = process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => res.status(status).json(body);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(405, { ok: false, message: 'Use o formulário de inscrição.' });
    }
    if (req.headers.origin && !ORIGINS.has(req.headers.origin) &&
        !(env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(req.headers.origin))) {
      return send(403, { ok: false, message: 'Acesse o formulário no site da escola.' });
    }
    let body = req.body;
    try {
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > 8192) return send(413, { ok: false, message: 'Dados inválidos.' });
        body = JSON.parse(body);
      }
    } catch {
      return send(400, { ok: false, message: 'Confira os dados do formulário.' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.hp) {
      return send(400, { ok: false, message: 'Confira os dados do formulário.' });
    }
    const nome = typeof body.nome === 'string' ? body.nome.trim().replace(/\s+/g, ' ') : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.whatsapp === 'string' ? body.whatsapp.replace(/\D/g, '') : '';
    if (nome.length < 2 || nome.length > 100) return send(400, { ok: false, field: 'nome', message: 'Escreva o seu nome.' });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(400, { ok: false, field: 'email', message: 'Confira o seu e-mail.' });
    if (!/^[1-9]\d{9,10}$/.test(phone)) return send(400, { ok: false, field: 'whatsapp', message: 'Escreva o seu WhatsApp com DDD.' });
    const url = new URL(FORM_URL);
    url.searchParams.set('EMAIL', email);
    url.searchParams.set('FNAME', nome);
    url.searchParams.set('PHONE', `+55${phone}`);
    url.searchParams.set('tags', EVENT_TAG_ID);
    url.searchParams.set('b_da6f3a2d4fd2aef20679be707_375e915980', '');
    url.searchParams.set('c', 'erveiraCallback');
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/javascript, application/json' } });
      if (!response.ok) throw new Error('upstream');
      const text = await response.text();
      // Parse the public embedded form's JSONP response as data; never execute it.
      const match = text.trim().match(/^(?:\/\*[^]*?\*\/\s*)?erveiraCallback\s*\(([^]*)\)\s*;?$/);
      const result = JSON.parse(match ? match[1] : text);
      const message = String(result.msg || '').replace(/<[^>]*>/g, '');
      if (result.result === 'success') {
        return send(200, { ok: true, pending: /confirm|confirmation|quase|almost/i.test(message) });
      }
      if (/already subscribed|j[áa] est[áa] inscrit|j[áa] cadastrad/i.test(message)) {
        return send(409, { ok: false, field: 'email', message: 'Este e-mail já está cadastrado no Mailchimp. Use outro e-mail para esta inscrição ou fale com a escola.' });
      }
      if (/too many|muitas tentativas/i.test(message)) return send(429, { ok: false, message: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' });
      return send(400, { ok: false, field: /email|e-mail/i.test(message) ? 'email' : undefined, message: 'O Mailchimp não aceitou os dados. Confira o e-mail e o WhatsApp e tente novamente.' });
    } catch {
      return send(502, { ok: false, message: 'Não conseguimos concluir sua inscrição agora. Tente novamente em instantes.' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
