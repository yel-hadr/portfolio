// POST /api/contact: the portfolio's contact form, sent through Resend. The API key stays here, in
// the Vercel project's environment; the site only knows this endpoint's URL.
//   RESEND_API_KEY   the Resend key (secret)
//   CONTACT_TO       where messages go (with Resend's test sender: your Resend account's address)
//   CONTACT_FROM     optional; defaults to Resend's test sender until you verify a domain
//   ALLOWED_ORIGINS  optional, comma-separated; defaults to the portfolio
import { Resend } from 'resend';

import { createContactHandler } from '../lib/contact.js';

const { RESEND_API_KEY, CONTACT_TO, CONTACT_FROM, ALLOWED_ORIGINS } = process.env;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export default {
  fetch: createContactHandler({
    send: resend && ((email) => resend.emails.send(email)),
    to: CONTACT_TO,
    from: CONTACT_FROM || 'Portfolio <onboarding@resend.dev>',
    origins: (ALLOWED_ORIGINS || 'https://yel-hadr.github.io')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  }),
};
