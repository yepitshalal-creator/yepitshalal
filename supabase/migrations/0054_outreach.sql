-- Asking London's halal places if we may use their photos, videos, menu and
-- logo, and keeping written proof of every yes.
--
-- Four tables, all private: only the service role (the admin, the daily
-- outreach job, and the /yes and /stop pages on the server) reads or writes
-- them. Nothing here touches a halal label, a verification or search.
--
-- The rules the brief set, held by the database rather than by care:
--   * Email goes only to a chain's head office, or to a place whose own
--     website names a limited company, and only to an address we found
--     published. A sole trader, a partnership, or "not sure" gets a call or
--     their contact form instead (PECR treats them as people). The check
--     constraint on outreach_contacts refuses anything else.
--   * One row per email address, so nobody is written to twice by mistake.
--   * The stop list is kept for good, across email, calls and forms.
--   * Sending starts switched off. outreach_settings.sending_on stays false
--     until Shabir says yes to the first send.

-- ============================================================================
-- Who we contact
-- ============================================================================

create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  -- A single place, or a chain's head office (one email covers every branch).
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  contact_name text,
  email text,
  phone text,
  -- The public page where we found the address. Every email says where.
  found_at_url text,
  found_how text not null check (found_how in ('osm', 'own_website', 'owner', 'phone_call', 'other')),
  business_kind text not null default 'unsure'
    check (business_kind in ('chain_head_office', 'limited_company', 'sole_trader', 'partnership', 'unsure')),
  -- The page on their own website that names the limited company.
  company_evidence_url text,
  channel text not null default 'phone' check (channel in ('email', 'phone', 'contact_form')),
  status text not null default 'new'
    check (status in ('new', 'ready', 'sent', 'followed_up', 'replied', 'said_yes', 'said_no', 'stopped', 'bounced', 'complained')),
  -- Opens this contact's /yes and /stop pages. 128 random bits.
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  -- Before a call that asks for permission: not on the TPS or CTPS lists.
  tps_checked_at timestamptz,
  sent_at timestamptz,
  resend_id text,
  followed_up_at timestamptz,
  followup_resend_id text,
  -- The last delivery event Resend reported for our latest email.
  last_event text,
  last_event_at timestamptz,
  replied_at timestamptz,
  answered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outreach_contacts_has_target check (restaurant_id is not null or brand_id is not null),
  constraint outreach_contacts_email_only_when_allowed check (
    channel <> 'email'
    or (
      email is not null
      and found_at_url is not null
      and (
        business_kind = 'chain_head_office'
        or (business_kind = 'limited_company' and company_evidence_url is not null)
      )
    )
  )
);

create unique index if not exists outreach_contacts_email_key
  on public.outreach_contacts (lower(email)) where email is not null;
create index if not exists outreach_contacts_status_idx on public.outreach_contacts (status, created_at);
create index if not exists outreach_contacts_restaurant_idx on public.outreach_contacts (restaurant_id);
create index if not exists outreach_contacts_brand_idx on public.outreach_contacts (brand_id);

-- ============================================================================
-- Never contact again
-- ============================================================================

create table if not exists public.outreach_stop_list (
  id uuid primary key default gen_random_uuid(),
  email text,
  -- Digits only, so "020 7123 4567" and "+44 20 7123 4567" match.
  phone text,
  -- Plain ids, not foreign keys: a stop outlives the listing it was about,
  -- and must never stop that listing being deleted or merged.
  restaurant_id uuid,
  brand_id uuid,
  reason text not null check (reason in ('stop_link', 'asked_by_email', 'asked_by_phone', 'said_no', 'bounced', 'complained')),
  created_at timestamptz not null default now(),
  constraint outreach_stop_list_has_target check (
    email is not null or phone is not null or restaurant_id is not null or brand_id is not null
  )
);

create unique index if not exists outreach_stop_list_email_key
  on public.outreach_stop_list (lower(email)) where email is not null;
create index if not exists outreach_stop_list_phone_idx on public.outreach_stop_list (phone) where phone is not null;
create index if not exists outreach_stop_list_restaurant_idx on public.outreach_stop_list (restaurant_id) where restaurant_id is not null;
create index if not exists outreach_stop_list_brand_idx on public.outreach_stop_list (brand_id) where brand_id is not null;

-- ============================================================================
-- Written proof of every yes
-- ============================================================================

create table if not exists public.content_permissions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.outreach_contacts(id) on delete set null,
  -- Set null, never cascade: the proof of a yes outlives the listing (a
  -- duplicate merged away, a place closed), so place_name keeps it readable.
  restaurant_id uuid references public.restaurants(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  place_name text not null,
  given_by_name text not null,
  given_by_role text not null check (given_by_role in ('owner', 'manager', 'head_office')),
  given_by_email text not null,
  -- The exact words they ticked, copied in full, and which version they were.
  words text not null,
  words_version text not null,
  agreed_at timestamptz not null default now(),
  -- What they told us on the page while they were there: price, menu link,
  -- opening hours in their own words. Owner facts, never guesses.
  extras jsonb not null default '{}'::jsonb,
  -- Taking it back. We then have 14 days to take everything down.
  withdrawn_at timestamptz,
  withdrawn_how text check (withdrawn_how in ('yes_page', 'by_email', 'by_phone')),
  -- When the admin confirmed everything was taken down.
  removed_at timestamptz
);

create index if not exists content_permissions_restaurant_idx on public.content_permissions (restaurant_id);
create index if not exists content_permissions_brand_idx on public.content_permissions (brand_id);
create index if not exists content_permissions_email_idx on public.content_permissions (lower(given_by_email));

-- ============================================================================
-- Photos and videos an owner adds on the /yes page
-- ============================================================================
--
-- Held in a private bucket until someone looks at them in /admin/outreach.
-- A photo is resized in the owner's browser before it is sent, into the two
-- sizes the site shows (960x720 and a 320x240 thumbnail, the same as every
-- other picture we store) plus one larger copy for social media. Publishing
-- copies the two small ones into the public photo bucket. Nothing an owner
-- sends is on the site before that.

create table if not exists public.owner_uploads (
  id uuid primary key default gen_random_uuid(),
  permission_id uuid not null references public.content_permissions(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  kind text not null check (kind in ('photo', 'video')),
  -- Paths in the owner-uploads bucket: {"full", "card", "thumb"} for a photo,
  -- {"video"} for a video.
  paths jsonb not null,
  bytes bigint not null check (bytes > 0),
  status text not null default 'uploading'
    check (status in ('uploading', 'waiting', 'published', 'kept', 'rejected', 'removed')),
  -- The restaurant_photos rows made from it, so taking a yes back removes them.
  photo_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists owner_uploads_status_idx on public.owner_uploads (status, created_at);
create index if not exists owner_uploads_permission_idx on public.owner_uploads (permission_id);

-- Private: files are reached only through short-lived signed links made by
-- the service role. 50 MB a file, the free plan's own limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('owner-uploads', 'owner-uploads', false, 52428800,
        array['image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

-- ============================================================================
-- The switch
-- ============================================================================

create table if not exists public.outreach_settings (
  id boolean primary key default true check (id),
  sending_on boolean not null default false,
  daily_limit integer not null default 25 check (daily_limit between 0 and 50),
  -- Set by the daily job on a complaint or too many bounces. Sending stays
  -- off until someone reads why and clears it.
  paused_reason text,
  paused_at timestamptz,
  -- When someone last cleared a pause. Bounces before it no longer count.
  resumed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.outreach_settings (id) values (true) on conflict (id) do nothing;

-- ============================================================================
-- Private: service role only
-- ============================================================================

alter table public.outreach_contacts enable row level security;
alter table public.outreach_stop_list enable row level security;
alter table public.content_permissions enable row level security;
alter table public.outreach_settings enable row level security;
alter table public.owner_uploads enable row level security;

revoke all on public.outreach_contacts, public.outreach_stop_list, public.content_permissions, public.outreach_settings,
  public.owner_uploads
  from anon, authenticated;
grant all on public.outreach_contacts, public.outreach_stop_list, public.content_permissions, public.outreach_settings,
  public.owner_uploads
  to service_role;

notify pgrst, 'reload schema';
