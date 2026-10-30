// The contact endpoint with a fake sender: nothing reaches Resend. Run: npm test (in contact-api)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createContactHandler } from '../lib/contact.js';

const SITE = 'https://yel-hadr.github.io';
const setup = ({ error = null, send = true, to = 'me@example.com' } = {}) => {
  const sent = [];
  const handler = createContactHandler({
    send: send ? async (email) => (sent.push(email), { data: { id: '1' }, error }) : null,
    to,
    from: 'Portfolio <onboarding@resend.dev>',
    origins: [SITE],
  });
  return { handler, sent };
};
const post = (body, { origin = SITE, raw } = {}) =>
  new Request('https://contact.example/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: raw ?? JSON.stringify(body),
  });
const valid = { name: 'Ada', email: 'ada@example.com', message: 'Hello there.' };

test('a valid message is sent as plain text, the visitor as reply-to', async () => {
  const { handler, sent } = setup();
  const res = await handler(post(valid));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get('access-control-allow-origin'), SITE);
  assert.equal(sent.length, 1);
  const [email] = sent;
  assert.equal(email.to, 'me@example.com');
  assert.equal(email.replyTo, 'ada@example.com');
  assert.equal(email.subject, 'Portfolio: a message from Ada');
  assert.match(email.text, /^Hello there\.\n\nAda <ada@example\.com>/);
  assert.equal(email.html, undefined);
});

test('the preflight is answered for the portfolio only', async () => {
  const { handler } = setup();
  const ask = (origin) =>
    handler(
      new Request('https://contact.example/api/contact', {
        method: 'OPTIONS',
        headers: { Origin: origin },
      })
    );
  const ok = await ask(SITE);
  assert.equal(ok.status, 204);
  assert.match(ok.headers.get('access-control-allow-headers'), /Content-Type/);
  const other = await ask('https://evil.example');
  assert.equal(other.status, 403);
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('another site, or no origin at all, is refused and nothing is sent', async () => {
  const { handler, sent } = setup();
  assert.equal((await handler(post(valid, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await handler(post(valid, { origin: null }))).status, 403);
  assert.equal(sent.length, 0);
});

test('only POST', async () => {
  const { handler } = setup();
  const res = await handler(
    new Request('https://contact.example/api/contact', { headers: { Origin: SITE } })
  );
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'POST, OPTIONS');
});

test('missing, empty, too long or malformed fields are refused', async () => {
  const { handler, sent } = setup();
  for (const body of [
    {},
    { ...valid, name: '' },
    { ...valid, email: 'not-an-address' },
    { ...valid, message: '   ' },
    { ...valid, name: 'x'.repeat(101) },
    { ...valid, message: 'x'.repeat(5001) },
    { ...valid, email: ['ada@example.com'] },
  ]) {
    assert.equal((await handler(post(body))).status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal((await handler(post(null, { raw: '{not json' }))).status, 400);
  assert.equal(sent.length, 0);
});

test('an oversized body is refused before it is parsed', async () => {
  const { handler, sent } = setup();
  const res = await handler(
    post(null, { raw: JSON.stringify({ ...valid, message: 'x'.repeat(20000) }) })
  );
  assert.equal(res.status, 413);
  assert.equal(sent.length, 0);
});

test('line breaks in the name never reach the subject', async () => {
  const { handler, sent } = setup();
  await handler(post({ ...valid, name: 'Ada\r\nBcc: victim@example.com' }));
  assert.equal(sent[0].subject, 'Portfolio: a message from Ada Bcc: victim@example.com');
  assert.doesNotMatch(sent[0].subject, /[\r\n]/);
});

test('the hidden field: a bot is told it worked, nothing is sent', async () => {
  const { handler, sent } = setup();
  const res = await handler(post({ ...valid, website: 'https://spam.example' }));
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test('a Resend error is a 502, without its details', async () => {
  const { handler } = setup({
    error: { name: 'validation_error', message: 'You can only send to yourself' },
  });
  const res = await handler(post(valid));
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'send' });
});

test('no key or no recipient: 503, nothing sent', async () => {
  assert.equal((await setup({ send: false }).handler(post(valid))).status, 503);
  assert.equal((await setup({ to: '' }).handler(post(valid))).status, 503);
});
