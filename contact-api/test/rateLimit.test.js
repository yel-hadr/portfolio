// The contact endpoint's rate limits (lib/rateLimit.js), on a fake clock
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clientOf, createRateLimiter } from '../lib/rateLimit.js';

const MINUTE = 60 * 1000;
const clock = () => {
  let t = 0;
  return { now: () => t, advance: (ms) => (t += ms) };
};

test('per client: five in ten minutes, then a wait until the oldest leaves the window', () => {
  const c = clock();
  const limit = createRateLimiter({ now: c.now });
  for (let i = 0; i < 5; i += 1) {
    assert.equal(limit('a').ok, true);
    c.advance(MINUTE);
  }
  const held = limit('a');
  assert.equal(held.ok, false);
  assert.equal(held.retryAfter, 5 * 60);
  c.advance(5 * MINUTE);
  assert.equal(limit('a').ok, true);
});

test('for everyone: thirty an hour, whatever the client', () => {
  const c = clock();
  const limit = createRateLimiter({ now: c.now });
  for (let i = 0; i < 30; i += 1) assert.equal(limit(`client-${i}`).ok, true);
  const held = limit('someone-new');
  assert.equal(held.ok, false);
  assert.equal(held.retryAfter, 60 * 60);
  c.advance(60 * MINUTE);
  assert.equal(limit('someone-new').ok, true);
});

test('a refused attempt is not counted against the client', () => {
  const c = clock();
  const limit = createRateLimiter({ perClient: 1, now: c.now });
  assert.equal(limit('a').ok, true);
  for (let i = 0; i < 10; i += 1) assert.equal(limit('a').ok, false);
  c.advance(10 * MINUTE);
  assert.equal(limit('a').ok, true);
});

test('the client is the first address Vercel reports', () => {
  const req = (headers) => new Request('https://x/', { headers });
  assert.equal(clientOf(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })), '203.0.113.7');
  assert.equal(clientOf(req({ 'x-real-ip': '198.51.100.2' })), '198.51.100.2');
  assert.equal(clientOf(req({})), 'unknown');
});
