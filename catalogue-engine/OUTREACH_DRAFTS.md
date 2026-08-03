# Supplier outreach drafts

Ready-to-send drafts for the outreach items in `README.md`'s "What I need from you" list. Copy,
adjust names/tone as needed, and send from whoever holds the wholesale account with each supplier
(these questions typically need to come from the account holder, not a third party). Fill in the
`[brackets]` before sending.

---

## 1. SanMar — integration access (send first, per the research findings)

**To:** sanmarintegrations@sanmar.com
**Subject:** Web Services / API integration access — Maple Imprint (SanMar Canada account)

> Hi SanMar Integrations team,
>
> We're Maple Imprint Ltd., an Ottawa-based custom printing and promotional products company
> with a **SanMar Canada** wholesale account ([account number]). We're building an internal
> system to sync your product catalogue, pricing, and inventory into our own website, and would
> like to set up API access.
>
> A few questions to get started:
>
> 1. Does your Web Services Integration Guide / PromoStandards program apply the same way to
>    **SanMar Canada** accounts, or is there separate onboarding for Canada?
> 2. What's the process to get UAT (test) environment access before moving to production?
> 3. Which services are we able to access — Product Info, Pricing, Inventory, and Purchase
>    Ordering are all of interest; PromoStandards Product Data / Inventory / Order Shipment
>    Notification as well if supported for our account.
> 4. Are there rate limits or usage guidelines we should design around?
>
> Happy to hop on a call if that's easier. Thanks!
>
> [Your name]
> Maple Imprint Ltd.
> [phone / email]

---

## 2. S&S Activewear — API access

**To:** via your S&S account rep, or through the contact options at `ssactivewear.com/marketing/edi`
(a human should open that page directly — our tooling couldn't fetch it automatically to confirm
the exact contact method)
**Subject:** API access request — Maple Imprint (S&S wholesale account)

> Hi [rep name / S&S team],
>
> We're Maple Imprint Ltd. ([account number]), and we'd like to set up API access to sync
> product, pricing, and inventory data into our own systems. We understand there's a REST API at
> `api.ssactivewear.com` as well as a PromoStandards option.
>
> Could you help us with:
>
> 1. Generating an API key for our account (we understand this is done via "My Account")
> 2. Confirming the current rate limit (we've seen 60 requests/minute mentioned — is that still
>    accurate?)
> 3. Any documentation beyond what's publicly listed, especially around image usage/redistribution
>    rights under our wholesale terms (see #4 below)
>
> Thanks!
>
> [Your name]
> Maple Imprint Ltd.
> [phone / email]

---

## 3. Joto Imaging Supplies — data feed / integration options

**To:** your Joto account contact (their site looks like it doesn't have a public developer API,
so this is a direct conversation, not an API signup)
**Subject:** Product data feed / catalogue sync options — Maple Imprint account

> Hi [contact name],
>
> We're setting up a system to keep our website's product catalogue in sync with your inventory
> and pricing. Since we didn't find a public API for this, we wanted to check directly:
>
> 1. Do you offer any kind of product/pricing/inventory data feed (CSV, XML export, EDI, etc.) to
>    wholesale accounts?
> 2. If not, what's the best way to keep our catalogue reasonably current — a periodic manual
>    export, or something else you'd recommend?
> 3. Are we permitted to download and use your product images on our own website under our
>    wholesale account? (see also #4 below)
>
> Thanks for your help!
>
> [Your name]
> Maple Imprint Ltd.
> [phone / email]

---

## 4. Image redistribution rights — reusable for any supplier not already covered above

Use this if a supplier's response to the above doesn't already answer it, or send standalone.

> Quick question about product images: under our wholesale account, are we permitted to
> download, cache, and display your product images on our own website/CDN? We want to make sure
> we're respecting your image usage terms before doing this at scale — happy to credit/attribute
> however you require.

---

## Notes for whoever sends these

- These went out as drafts, not sent — nothing has been emailed on your behalf.
- Once you get responses (credentials, API docs, confirmed rate limits, image rights answers),
  paste them back and the actual connector implementation can start — see
  `src/integrations/suppliers/_template/README.md` for exactly what happens next once access
  exists.
- Never paste raw API keys/passwords into a chat thread if you can avoid it — describe what you
  have and where it's stored, and it can be wired into `.env` from there without needing to see
  the raw secret directly in conversation.
