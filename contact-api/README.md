# Contact endpoint

The portfolio is a static site on GitHub Pages, so it cannot hold a Resend API key: anything in the
site's JavaScript is public. This folder is a separate Vercel project with one function,
`POST /api/contact`, that holds the key and sends the contact form through Resend. The site only
knows the function's URL.

What it does (`lib/contact.js`):

- answers only the origins in `ALLOWED_ORIGINS` (CORS), and only `POST`;
- checks the fields (name, email, message; lengths as in the form), refuses bodies over 16 KB;
- sends the message to you as plain text, with the visitor's address as the reply-to;
- drops messages that fill the form's hidden `website` field (bots), answering as if it worked.

## Deploy (once)

1. In Resend, create an API key (**API Keys**, sending access). Never paste it into the site or
   commit it.
2. In Vercel, **Add New → Project**, import `yel-hadr/portfolio`, and set **Root Directory** to
   `contact-api`. No framework, no build command.
3. In the project's **Settings → Environment Variables** (Production), add:

   | Name | Value |
   | --- | --- |
   | `RESEND_API_KEY` | the key from step 1 (mark it Sensitive) |
   | `CONTACT_TO` | where messages go. With Resend's test sender this must be the address your Resend account uses |
   | `CONTACT_FROM` | optional. Defaults to `Portfolio <onboarding@resend.dev>`; set it to an address on a domain you verified in Resend to send from your own domain |
   | `ALLOWED_ORIGINS` | optional. Defaults to `https://yel-hadr.github.io`; add `http://localhost:5173` (comma-separated) to test from the dev server |

4. Deploy. The endpoint is `https://<your-project>.vercel.app/api/contact`.
5. In GitHub, **Settings → Secrets and variables → Actions → Variables**, add
   `VITE_CONTACT_ENDPOINT` with that URL. The next deploy of the site uses it. For local
   development, put the same line in the repo's `.env`.

From the command line instead: `npx vercel login`, then in this folder `npx vercel link`,
`npx vercel env add RESEND_API_KEY production` (and the others), and `npx vercel --prod`.

## Test

`npm test` here runs the endpoint against a fake sender (nothing is sent). CI runs it too.

A real message: open the site, send the form, and check the inbox of `CONTACT_TO`. Resend's
dashboard (**Emails**) shows each send and any error.
