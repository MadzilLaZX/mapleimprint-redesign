-- Creates the design-uploads bucket on a fresh project, PRIVATE from the start -- unlike the live
-- production bucket, which is still public as of this file being written. Staging exists
-- specifically to validate the private-bucket cutover (see docs/private-bucket-cutover.md)
-- before it happens on production, so there is no reason for staging to start in the
-- less-secure state production is still in.

insert into storage.buckets (id, name, public)
values ('design-uploads', 'design-uploads', false)
on conflict (id) do nothing;

-- THE ACCESS POLICY FOR THIS BUCKET IS DELIBERATELY NOT INCLUDED HERE. The real production
-- bucket's storage.objects policy was never captured as SQL anywhere in this repo (confirmed
-- during the private-storage readiness review), and reconstructing/publishing a guess at its
-- logic in a public repo -- while the real bucket is still public -- is exactly the kind of
-- access-control detail this project has an explicit standing rule against disclosing.
--
-- Instead: in the Supabase dashboard, open the PRODUCTION project's Authentication -> Policies ->
-- storage.objects entry for this bucket, and recreate the same policy on staging's bucket
-- directly through the dashboard UI (not by typing SQL from memory here). That keeps the one
-- authoritative definition of that policy in exactly one place until it's deliberately reviewed
-- and captured as real SQL -- the same standard the rest of this repo's migrations hold
-- themselves to (see 004_assets.sql's own comment on confirming its policy against the live
-- project before committing it, rather than guessing).
