# Contact automation setup

This covers what's needed to make the `/contact` page's three forms (quote wizard, general
inquiry, appointment request) actually deliver: a CRM record, a customer confirmation email, an
owner notification (email + Telegram), and real file uploads. Code lives in
`src/lib/automation/` and `src/app/api/{quote,contact,appointment,upload}/route.ts`.

Without any of the accounts below configured, the forms still work end-to-end and return a real
reference number — they just log a warning and skip that channel (see "Degrades gracefully"
below). Nothing here is required to keep the site building/deploying.

## 1. Supabase (CRM database + file storage)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run `src/lib/automation/schema.sql` once — creates the `inquiries` and
   `attachments` tables.
3. Go to Storage and create a new bucket named `inquiry-attachments`. Leave it **private** (not
   public) since uploaded artwork may not be meant for public URLs.
4. Go to Project Settings > API and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (not the anon key) → `SUPABASE_SERVICE_ROLE_KEY`

The service role key bypasses row-level security, which is intentional here: only the server-side
API routes ever use it, never the browser.

## 2. Resend (transactional email)

1. Create an account at [resend.com](https://resend.com).
2. Add and verify `mapleimprint.ca` under Domains (adds a few DNS records — TXT/CNAME — at your
   DNS provider). Sending will fail until the domain is verified.
3. Create an API key under API Keys → `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to an address on the verified domain, e.g. `quotes@mapleimprint.ca`.
5. Set `OWNER_NOTIFICATION_EMAIL` to whichever inbox should receive new-lead alerts (defaults to
   `info@mapleimprint.ca` if unset in code, but set it explicitly).

## 3. Telegram (instant owner alerts)

1. In Telegram, message **@BotFather**, run `/newbot`, and follow the prompts. You'll get a bot
   token → `TELEGRAM_BOT_TOKEN`.
2. Start a chat with your new bot (or add it to a group), send it any message, then visit
   `https://api.telegram.org/bot<token>/getUpdates` in a browser to find the numeric `chat.id` →
   `TELEGRAM_CHAT_ID`.

## 4. Setting the env vars

Copy `.env.example` to `.env.local` for local development. For production, add the same key/value
pairs in the Vercel dashboard: Project → Settings → Environment Variables, then redeploy.

## Degrades gracefully

Each channel is independently optional at runtime:
- No Supabase configured → inquiry isn't saved to a CRM table, file uploads return a friendly 503
  error client-side (the wizard's Files step is optional, so the customer can still submit),
  and reference numbers fall back to a random suffix instead of a per-day sequence.
- No Resend configured → no emails sent, logged as a warning server-side.
- No Telegram configured → no Telegram message sent, logged as a warning server-side.

In all cases the customer-facing submission still succeeds and returns a reference number — a
missing third-party integration should never look like a broken form to a customer.

## What's not built yet

- No CRM UI/dashboard to browse or update inquiry status — the `inquiries`/`attachments` tables
  exist, but reading them means using the Supabase table editor directly for now.
- No real calendar-conflict checking for `/api/appointment` — it validates and records the
  request but doesn't check staff availability.
- Lead scoring parses the wizard's free-text quantity/budget fields with simple heuristics (looks
  for numbers like "500+" or "$2500"), since those are text inputs, not the dropdown tiers from
  the original spec. Converting them to dropdowns would make scoring more precise, but is a UI
  change outside this pass.
