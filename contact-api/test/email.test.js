// The contact email's layout (lib/email.js): what a visitor typed never becomes markup
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { escapeHtml, renderContactEmail } from '../lib/email.js';

const SITE = 'https://yel-hadr.github.io';
const DATE = new Date(Date.UTC(2026, 9, 30, 18, 5));
const render = (fields) =>
  renderContactEmail(
    { name: 'Ada', email: 'ada@example.com', message: 'Hello.', ...fields },
    { site: SITE, date: DATE }
  );

test('escapeHtml covers the five characters that matter', () => {
  assert.equal(
    escapeHtml(`<a href="x" onclick='y'>&</a>`),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
  );
});

test('markup typed into the name or the message is shown, never run', () => {
  const { html } = render({
    name: '<img src=x onerror=alert(1)>',
    message: '<script>alert(1)</script>\n<a href="javascript:x">click</a>',
  });
  // No tag or link from the input: its text only shows (escaped), so "onerror=" may appear as text
  assert.doesNotMatch(html, /<script|<img|<a href="javascript:/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('line breaks in the message are kept', () => {
  const { html, text } = render({ message: 'Line one\nLine two\r\nLine three' });
  assert.match(html, /Line one<br>Line two<br>Line three/);
  assert.match(text, /Line one\nLine two\r\nLine three/);
});

test('the reply button writes to the visitor, with the subject', () => {
  const { html } = render({ email: "o'brien+test@example.com" });
  assert.match(
    html,
    /href="mailto:o&#39;brien%2Btest%40example\.com\?subject=Re%3A%20Portfolio%3A%20a%20message%20from%20Ada"/
  );
  assert.match(html, />Reply to Ada</);
});

test('the subject, the plain-text twin, the site and the time', () => {
  const { subject, html, text } = render({});
  assert.equal(subject, 'Portfolio: a message from Ada');
  assert.equal(
    text,
    [
      'New message from your portfolio',
      '',
      'From: Ada <ada@example.com>',
      '',
      'Hello.',
      '',
      '---',
      'Reply to this email to answer Ada.',
      'Sent from the contact form on yel-hadr.github.io, 30 October 2026 at 18:05 UTC',
    ].join('\n')
  );
  assert.match(html, /yel-hadr\.github\.io<\/a> · 30 October 2026 at 18:05 UTC/);
  assert.match(html, /<title>Portfolio: a message from Ada<\/title>/);
});
