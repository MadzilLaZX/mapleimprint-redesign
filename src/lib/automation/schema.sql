-- Maple Imprint contact automation schema.
-- Run this once in the Supabase project's SQL editor (Database > SQL Editor).
-- Two tables only: inquiries (one row per quote/contact/appointment submission)
-- and attachments (files linked to an inquiry). See AUTOMATION.md for setup.

create extension if not exists pgcrypto;

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  source text not null check (source in ('quote', 'contact', 'appointment')),
  status text not null default 'new',
  name text not null,
  organization text,
  email text not null,
  phone text,
  preferred_contact text,
  project_type text,
  product_description text,
  quantity text,
  budget_range text,
  decoration_method text,
  placements text,
  needed_by date,
  event_date date,
  delivery_method text,
  postal_code text,
  message text,
  score int not null default 0,
  tags text[] not null default '{}',
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists inquiries_created_at_idx on inquiries (created_at desc);
create index if not exists inquiries_reference_prefix_idx on inquiries (reference text_pattern_ops);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references inquiries(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size int,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists attachments_inquiry_id_idx on attachments (inquiry_id);

-- Storage bucket for uploaded artwork/reference files. Create it via the
-- Supabase dashboard (Storage > New bucket) named "inquiry-attachments",
-- set to private (not public) since files may include unpublished artwork.
-- The server-side service role key used by this app bypasses RLS, so no
-- storage policies are required for the app itself to read/write.
