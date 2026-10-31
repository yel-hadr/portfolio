// The contact form's endpoint: checks where the request comes from and what it holds, then hands
// the message to `send` (Resend in api/contact.js, a fake in the tests), laid out by
// lib/email.js (HTML with every typed value escaped, and a plain-text twin). The visitor's address
// goes only in the reply-to and the body, never in a header of its own.
import { renderContactEmail } from './email.js';
import { clientOf } from './rateLimit.js';

const LIMITS = { name: 100, email: 254, message: 5000 };
// Larger bodies are refused: by their declared length, or as soon as reading passes it
const MAX_BODY = 16 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The body as text, read as a stream and abandoned once it passes `max` bytes (a chunked body
 * declares no length, so it is never held whole). Resolves to null when too large
 */
const readBody = async (request, max) => {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

// Line breaks and other control characters out of one-line fields (the name goes in the subject)
const oneLine = (value) => value.replace(/\p{Cc}+/gu, ' ').trim();

/** The three fields, trimmed, or null when one is missing, too long or not an address */
export const readFields = (body) => {
  if (!body || typeof body !== 'object') return null;
  const { name, email, message } = body;
  if (![name, email, message].every((v) => typeof v === 'string')) return null;
  const fields = { name: oneLine(name), email: oneLine(email), message: message.trim() };
  const fits = Object.entries(LIMITS).every(
    ([k, max]) => fields[k].length > 0 && fields[k].length <= max
  );
  return fits && EMAIL.test(fields.email) ? fields : null;
};

/**
 * @param send     ({ from, to, replyTo, subject, text }) => Promise<{ error }>, or null when unset
 * @param to       the address messages go to
 * @param from     the sender, an address Resend may send from
 * @param origins  the sites allowed to post (the portfolio, and a dev server when testing)
 * @param limit    optional (client) => { ok, retryAfter }: lib/rateLimit.js; none in some tests
 */
export const createContactHandler =
  ({ send, to, from, origins, limit }) =>
  async (request) => {
    const origin = request.headers.get('origin');
    const allowed = Boolean(origin) && origins.includes(origin);
    const headers = allowed
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' };
    const reply = (status, body, extra = {}) =>
      Response.json(body, { status, headers: { ...headers, ...extra } });

    if (request.method === 'OPTIONS')
      return new Response(null, { status: allowed ? 204 : 403, headers });
    if (request.method !== 'POST')
      return reply(405, { error: 'method' }, { Allow: 'POST, OPTIONS' });
    // A browser on another site: refused (the Origin header is the browser's, not the page's)
    if (!allowed) return reply(403, { error: 'origin' });
    if (!send || !to) {
      console.error('Contact endpoint not configured: set RESEND_API_KEY and CONTACT_TO');
      return reply(503, { error: 'unconfigured' });
    }
    if (Number(request.headers.get('content-length')) > MAX_BODY)
      return reply(413, { error: 'size' });

    let body;
    try {
      const raw = await readBody(request, MAX_BODY);
      if (raw === null) return reply(413, { error: 'size' });
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: 'invalid' });
    }
    // The form's hidden field: only a bot fills it. Answered as a success, so it learns nothing
    if (typeof body?.website === 'string' && body.website !== '') return reply(200, { ok: true });
    const fields = readFields(body);
    if (!fields) return reply(400, { error: 'invalid' });

    // Counted only for messages that would be sent: a bot caught above or a typo spends nothing
    const allowance = limit ? limit(clientOf(request)) : { ok: true };
    if (!allowance.ok) {
      return reply(429, { error: 'rate' }, { 'Retry-After': String(allowance.retryAfter) });
    }

    const { subject, html, text } = renderContactEmail(fields, { site: origin });
    // A thrown error (the network to Resend down, a timeout, the SDK failing) is a clean 502 too,
    // not an unhandled exception the platform answers with a bare 500
    let error;
    try {
      ({ error } = await send({ from, to, replyTo: fields.email, subject, html, text }));
    } catch (thrown) {
      console.error('Sending through Resend failed:', thrown?.name, thrown?.message);
      return reply(502, { error: 'send', reason: 'network' });
    }
    if (error) {
      console.error('Resend refused the message:', error.name, error.message);
      // Resend's error type (validation_error, invalid_api_key…) says what to fix; never its
      // message, which can name the account's address
      return reply(502, { error: 'send', reason: String(error.name ?? 'unknown') });
    }
    return reply(200, { ok: true });
  };
