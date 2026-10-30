# Contact endpoint

The portfolio is a static site on GitHub Pages, so it cannot hold a Resend API key: anything in the
site's JavaScript is public. This folder is a separate Vercel project with one function,
`POST /api/contact`, that holds the key and sends the contact form through Resend. The site only
knows the function's URL.

What it does (`lib/contact.js`):

- answers only the origins in `ALLOWED_ORIGINS` (CORS), and only `POST`;
- checks the fields (name, email, message; lengths as in the form), refuses bodies over 16 KB;
- sends the message to you laid out by `lib/email.js`: an HTML email (the site's light theme,
  inline styles, every typed value escaped, a Reply button) with a plain-text version, and the
  visitor's address as the reply-to;
- drops messages that fill the form's hidden `website` field (bots), answering as if it worked;
- rate-limits what it would send (`lib/rateLimit.js`): 5 messages per client per 10 minutes and 30
  per hour for everyone, answering 429 with `Retry-After` past either. The counts live in the
  function's memory, so they hold while an instance is warm and restart with a new one.

For a limit that survives every instance, add a rule in the Vercel project's **Firewall** (Rate
Limiting, on the path `/api/contact`, for example 10 requests per minute per IP). It applies
before the function runs.

## Deploy

From GitHub Actions (the `deploy-contact-api` job in `.github/workflows/deploy.yml`), with three
repository **secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | a Resend API key (sending access). Never paste it into the site or commit it |
| `CONTACT_TO` | where messages go. With Resend's test sender this must be the address your Resend account uses |
| `VERCEL_TOKEN` | a Vercel access token (vercel.com → Account Settings → Tokens) |

The job runs on every push to `main`, and on a manual run (Actions → CI/CD Pipeline → Run
workflow, on any branch). It creates the Vercel project `yel-hadr-contact` the first time, deploys
this folder to production with the two secrets as the function's environment, checks that the
endpoint answers the site's preflight, and prints its URL in the run's summary.

Then set the repository **variable** `VITE_CONTACT_ENDPOINT` to that URL (the job warns while it
differs). The next deploy of the site uses it. For local development, put the same line in the
repo's `.env`, and allow the dev server's origin (below).

Optional settings, in the Vercel project (Settings → Environment Variables):

- `CONTACT_FROM`: defaults to `Portfolio <onboarding@resend.dev>`; set it to an address on a
  domain you verified in Resend to send from your own domain (and to any recipient);
- `ALLOWED_ORIGINS`: defaults to `https://yel-hadr.github.io`; add `http://localhost:5173`
  (comma-separated) to test from the dev server.

## The email's look

`lib/email.js` holds the layout. Email clients ignore CSS variables and classes, so its colors are
the site's light theme written out as hex (keep them in step with `src/index.css`), and the layout
is tables with inline styles. To preview a change, render one to a file and open it:

```bash
node --input-type=module -e "import { writeFileSync } from 'node:fs'; import { renderContactEmail } from './lib/email.js'; writeFileSync('/tmp/email.html', renderContactEmail({ name: 'Ada', email: 'ada@example.com', message: 'Hello!' }, { site: 'https://yel-hadr.github.io' }).html)"
```

## Test

`npm test` here runs the endpoint against a fake sender (nothing is sent). CI runs it too.

A real message: open the site, send the form, and check the inbox of `CONTACT_TO`. Resend's
dashboard (**Emails**) shows each send and any error.
