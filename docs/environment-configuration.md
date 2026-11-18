# Supabase environment configuration

Which Supabase project this app connects to is now fully environment-configured. Before this
round, `src/lib/studio/supabaseClient.ts` and `src/lib/server/supabaseAdmin.ts` both hardcoded the
project connection as a source constant — meaning local dev, every Vercel Preview deployment, and
Production all necessarily reached the same project, with no way to point any of them anywhere
else without editing code. That's now gone: both files read their connection from environment
variables, with **no hardcoded fallback and no silent default to another project** if one is
missing — a missing variable fails the request that needed it, rather than guessing.

This document covers exactly which variables exist, what each one is, and which Vercel
environments need them set to which values. For actually creating a staging project to point
Preview at, see `supabase/staging-baseline/README.md` (schema) and
`docs/local-test-environment-setup.md` (local/isolated instance option).

## The three variables

| Variable | Secret? | Where to get it | Used by |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No — a project URL isn't sensitive on its own | Supabase dashboard → Project Settings → API → Project URL | Both clients below |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No — Supabase's anon/publishable key is designed to be public; access control comes from RLS policies, not from keeping this hidden | Same page → anon/public key | `createStudioClient()` (Studio's session-scoped client) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes — a real secret.** Bypasses Row Level Security entirely | Same page → service_role key | `createAdminClient()` (checkout/order/payment/admin routes) |

The `NEXT_PUBLIC_` prefix on the first two is the Next.js convention for "safe to expose to the
browser" — nothing in this codebase currently imports `createStudioClient` into a browser bundle
(every importer is a server route or server-only lib), but naming it this way now means no rename
is needed if that ever changes.

## Which Vercel environment needs which values

Vercel lets you set different values for the same variable name per environment
(Production / Preview / Development) under Project Settings → Environment Variables. That per-
environment split is the actual mechanism that decouples Preview from Production — the code change
in this round only removes the *obstacle* (the hardcoded constant) to using it.

- **Production**: set all three variables to the real, currently-live project's values — the same
  project this app has always talked to. **Do this before deploying this round's code.** If
  Production's env vars aren't set when this deploys, every Supabase-dependent request (checkout,
  Studio, quotes, admin) fails closed with a clear "X is not set" error instead of silently
  breaking some other way — by design, but still worth avoiding by setting these first. This step
  preserves today's behavior exactly; nothing about what Production connects to changes, only how
  the connection is configured.
- **Preview**: until a staging project exists, set Preview to the **same** values as Production —
  this preserves today's actual behavior (Preview has always reached the live project; see
  `docs/local-test-environment-setup.md` section 0 for how that was confirmed) without any
  surprise change in this round. **Once a staging project exists** (`supabase/staging-baseline/`
  has the schema to build one), switch Preview's env vars to the staging project's values instead
  — that one change is what actually separates Preview/development testing from Production, with
  no code change needed on either side of that switch.
- **Development** (`.env.local`, gitignored — never commit real values here): same three
  variables. Point at Production's values for continuity with today, or at a staging/local
  instance once one exists — either works, since the app itself doesn't know or care which
  project it's talking to anymore.

## Fail-closed behavior

Both `createStudioClient()` and `createAdminClient()` check for their required variables lazily
(only when actually constructing a client to make a real call — see `src/lib/server/
supabaseEnv.ts`'s own comment for why this is lazy rather than a module-level check) and throw
immediately if one is missing, naming exactly which variable:

```
Error: NEXT_PUBLIC_SUPABASE_URL is not set. This project's Supabase connection is fully
environment-configured -- there is no hardcoded fallback, and it never silently defaults to
another project. Set it in .env.local for local development, or in the appropriate Vercel
Environment Variables for Preview/Production. See docs/environment-configuration.md.
```

This surfaces as a 502/500 response from whichever API route triggered it — never a successful
response against the wrong project, and never a successful response against no project at all
with silently empty data. Regression tests for this (`src/lib/server/supabaseEnv.test.ts`,
`src/lib/studio/supabaseClient.test.ts`, `src/lib/server/supabaseAdmin.test.ts`) assert exactly
this: missing variable → throws, naming the variable; variables present → succeeds, using
whatever is actually configured (never a hardcoded project).

## `knownProductionSupabaseProject.ts` — the one place production is still named directly

`src/lib/server/knownProductionSupabaseProject.ts` is the single remaining place in the repo that
identifies the production project by name, used only to make integration tests and scripts refuse
(or, for two cloud-pointed integration test files, require extra confirmation) before touching it.
See that file's own comment and `src/lib/checkout/fulfillOrder.integration.test.ts`'s header for
how it's used. Nothing in the application's own request-serving code path uses it or needs to.
