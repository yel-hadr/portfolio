// The email a contact message arrives as: an HTML layout and its plain-text twin. Email clients
// ignore CSS variables, classes and most of <style>, so the layout is tables with inline styles,
// and its colors are the site's light theme written out (src/index.css, [data-theme='light']).
// A light design also survives the mail apps that recolor dark emails. Every value a visitor typed
// is escaped before it goes into the HTML.

const C = {
  page: '#f4efe8', // --c-ground
  card: '#fffdfa', // the cream glass, opaque
  line: '#e7dfd4',
  ink: '#1a1a2e', // --c-foreground
  muted: '#5c5650', // --c-foreground-muted
  accent: '#e85d04', // --c-primary: the bar, the quote's edge, the button (dark text on it)
  link: '#a84300', // --c-primary-400: orange text, 4.5:1 and up on the card
  quote: '#faf7f2', // --c-background
};
const FONT = "'Poppins', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// The time it arrived, in UTC (the function knows no visitor's time zone)
const stamp = (date) =>
  `${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`;

/**
 * @param fields  { name, email, message }: already checked by readFields (lib/contact.js)
 * @param site    the origin the form was sent from, e.g. https://yel-hadr.github.io
 * @param date    when it arrived
 * @returns { subject, html, text }
 */
export const renderContactEmail = ({ name, email, message }, { site, date = new Date() }) => {
  const subject = `Portfolio: a message from ${name}`;
  const when = stamp(date);
  const host = site.replace(/^https?:\/\//, '');
  const reply = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Re: ${subject}`)}`;
  const n = escapeHtml(name);
  const e = escapeHtml(email);
  // Line breaks kept: escaped first, then <br> (white-space: pre-wrap is not everywhere)
  const body = escapeHtml(message).replace(/\r?\n/g, '<br>');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${n} wrote to you from your portfolio.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:16px;">
<tr><td style="height:4px;background:${C.accent};border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 8px;font-family:${FONT};">
<p style="margin:0 0 6px;font-size:13px;line-height:20px;color:${C.muted};">New message from your portfolio</p>
<h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;color:${C.ink};">${n}</h1>
<p style="margin:4px 0 0;font-size:15px;line-height:22px;"><a href="mailto:${encodeURIComponent(email)}" style="color:${C.link};text-decoration:underline;">${e}</a></p>
</td></tr>
<tr><td style="padding:20px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background:${C.quote};border-left:3px solid ${C.accent};border-radius:8px;padding:16px 20px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.ink};word-break:break-word;">${body}</td></tr>
</table>
</td></tr>
<tr><td style="padding:20px 32px 28px;font-family:${FONT};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:10px;background:${C.accent};">
<a href="${escapeHtml(reply)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:700;line-height:20px;color:${C.ink};text-decoration:none;border-radius:10px;">Reply to ${n}</a>
</td></tr></table>
<p style="margin:12px 0 0;font-size:13px;line-height:20px;color:${C.muted};">Or just reply to this email: it goes to ${e}.</p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid ${C.line};font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">
Sent from the contact form on <a href="${escapeHtml(site)}" style="color:${C.muted};">${escapeHtml(host)}</a> · ${when}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `New message from your portfolio`,
    ``,
    `From: ${name} <${email}>`,
    ``,
    message,
    ``,
    `---`,
    `Reply to this email to answer ${name}.`,
    `Sent from the contact form on ${host}, ${when}`,
  ].join('\n');

  return { subject, html, text };
};
