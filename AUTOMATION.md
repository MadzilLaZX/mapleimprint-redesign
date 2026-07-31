# Contact automation setup

This covers what's needed to make the `/contact` page's three forms (quote wizard, general
inquiry, appointment request) actually deliver: a lead logged to a Google Sheet, a customer
confirmation email, an owner notification (email + Telegram), and real file uploads to Google
Drive. Code lives in `src/lib/automation/` and
`src/app/api/{quote,contact,appointment,upload}/route.ts`.

Without any of the accounts below configured, the forms still work end-to-end and return a real
reference number — they just log a warning and skip that channel (see "Degrades gracefully"
below). Nothing here is required to keep the site building/deploying.

## 1. Google Cloud service account (Sheets + Drive)

One service account covers both the spreadsheet and file uploads — set it up once.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (or
   use an existing one), e.g. "Maple Imprint Automation".
2. In **APIs & Services > Library**, enable both **Google Sheets API** and **Google Drive API**.
3. In **APIs & Services > Credentials**, click **Create Credentials > Service account**. Give it
   any name (e.g. `contact-automation`). No roles/permissions are needed at the project level —
   access is granted per-file in steps 5-6 below.
4. Open the new service account, go to the **Keys** tab, **Add Key > Create new key > JSON**, and
   download it. Open that JSON file:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (paste the whole string including
     `-----BEGIN PRIVATE KEY-----`/`-----END PRIVATE KEY-----`; keep the `\n` sequences as literal
     backslash-n, don't convert them to real newlines)
5. Create a new Google Sheet (e.g. "Maple Imprint Leads"). Add a header row in row 1 exactly
   matching the columns in `src/lib/automation/sheets.ts` (`Timestamp`, `Reference`, `Source`,
   `Score`, `Tags`, `Name`, `Organization`, `Email`, `Phone`, `Preferred Contact`, `Project Type`,
   `Product Description`, `Quantity`, `Budget Range`, `Decoration Method`, `Placements`,
   `Design Help`, `Needed By`, `Event Date`, `Delivery Method`, `Postal Code`, `Message`,
   `File Links`, `Status`). Rename the tab itself to `Leads` (the default "Sheet1" won't match).
   Click **Share** and add the service account's `client_email` as an **Editor**. Copy the sheet
   ID from the URL (`.../spreadsheets/d/<ID>/edit`) → `GOOGLE_SHEET_ID`.
6. Create a Google Drive folder (e.g. "Maple Imprint — Uploaded Artwork"). Share it with the
   service account's `client_email` as an **Editor**. Copy the folder ID from its URL
   (`drive.google.com/drive/folders/<ID>`) → `GOOGLE_DRIVE_FOLDER_ID`. Files the automation
   uploads will appear inside this folder, visible to anyone who already has access to it (e.g.
   you, since you created it) — no separate sharing step per file.

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
- No Google service account configured → the inquiry isn't logged to the Sheet, file uploads
  return a friendly 503 error client-side (the wizard's Files step is optional, so the customer
  can still submit), and reference numbers fall back to a random suffix instead of a per-day
  sequence.
- No Resend configured → no emails sent, logged as a warning server-side.
- No Telegram configured → no Telegram message sent, logged as a warning server-side.

In all cases the customer-facing submission still succeeds and returns a reference number — a
missing third-party integration should never look like a broken form to a customer.

## What's not built yet

- No dashboard beyond the spreadsheet itself — status changes, notes, and staff assignment would
  need to be tracked as extra columns/manual edits in the Sheet for now.
- No real calendar-conflict checking for `/api/appointment` — it validates and records the
  request but doesn't check staff availability.
- Lead scoring parses the wizard's free-text quantity/budget fields with simple heuristics (looks
  for numbers like "500+" or "$2500"), since those are text inputs, not the dropdown tiers from
  the original spec. Converting them to dropdowns would make scoring more precise, but is a UI
  change outside this pass.
- The Sheets-based reference-number sequence reads the whole `Reference` column on every
  submission to count today's rows — fine at this scale, but would need a different approach
  (e.g. a real database) if lead volume grows very large.
