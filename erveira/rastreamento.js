(function () {
  'use strict';
  const pixel = '954778512899267';
  const map = { utm_source: 'USOURCE', utm_medium: 'UMEDIUM', utm_campaign: 'UCAMPAIGN', utm_content: 'UCONTENT', utm_term: 'UTERM', fbclid: 'FBCLID' };
  const source = {};
  try { Object.assign(source, JSON.parse(sessionStorage.getItem('erveira-origem') || '{}')); } catch {}
  const query = new URLSearchParams(location.search);
  for (const [key, field] of Object.entries(map)) if (query.has(key)) source[field] = query.get(key).slice(0, 500);
  if (query.has('fbclid')) source.fbclid_time = Date.now();
  try { sessionStorage.setItem('erveira-origem', JSON.stringify(source)); } catch {}
  const cookie = name => document.cookie.split('; ').find(part => part.startsWith(name + '='))?.slice(name.length + 1) || '';
  const track = (...args) => { try { if (typeof window.fbq === 'function') window.fbq(...args); } catch {} };
  const form = document.getElementById('form-inscricao');
  if (form) {
    let started = false;
    const start = event => {
      if (started || !event.target.matches('input:not([name="hp"])')) return;
      started = true;
      track('trackCustom', 'IniciouInscricao');
    };
    form.addEventListener('pointerdown', start);
    form.addEventListener('focusin', start);
  }
  const group = document.getElementById('botao-grupo');
  if (group) group.addEventListener('click', () => track('trackCustom', 'EntrouGrupoWhatsApp'));
  window.erveiraTracking = {
    attribution: () => Object.fromEntries(Object.values(map).filter(key => source[key]).map(key => [key, source[key]])),
    eventId: () => 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10),
    async lead(data, result) {
      if (!result.ok || result.pending || !data.event_id) return;
      const firstName = data.nome.trim().split(/\s+/)[0].toLowerCase();
      const email = data.email.trim().toLowerCase(), phone = '55' + data.whatsapp.replace(/\D/g, '');
      track('init', pixel, { em: email, fn: firstName, ph: phone, country: 'br' });
      track('track', 'Lead', { content_name: 'O Despertar da Erveir@', value: 0, currency: 'BRL' }, { eventID: data.event_id });
      let fbc = cookie('_fbc');
      if (!fbc && source.FBCLID) fbc = 'fb.1.' + (source.fbclid_time || Date.now()) + '.' + source.FBCLID;
      const started = Date.now();
      const post = fetch('/api/meta-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ event_id: data.event_id, email, phone, first_name: firstName, fbp: cookie('_fbp'), fbc, event_source_url: location.href, receipt: result.meta_receipt }) }).catch(() => {});
      await Promise.race([post, new Promise(resolve => setTimeout(resolve, 1500))]);
      const remaining = 400 - (Date.now() - started);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    }
  };
})();
