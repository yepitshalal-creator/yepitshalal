-- Places a person should look at, raised by a job rather than by a visitor
-- (the 2026-10-12 plan, Step 2).
--
-- The first reason: a listed place's food hygiene registration has left the
-- FSA's files (lib/hygiene/refresh.ts, every Tuesday). That can mean it closed,
-- changed hands or moved council, and a source dropping a record is not proof
-- of any of them (see catalogue_status in 0018). So this is a flag and never a
-- change: the place stays listed, with its label, until a person decides.
--
-- Read and written only with the service role, from the admin and the job.

create table if not exists public.place_flags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  reason text not null check (reason in ('left_fsa_register')),
  -- What the job saw, in words, for whoever opens the flag.
  detail text,
  flagged_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

-- One open flag per place and reason. The job reads the open ones and skips
-- those, so a place that stays off the register is not flagged every week.
create unique index if not exists place_flags_one_open_idx
  on public.place_flags (restaurant_id, reason)
  where resolved_at is null;

create index if not exists place_flags_open_idx
  on public.place_flags (flagged_at desc)
  where resolved_at is null;

alter table public.place_flags enable row level security;

comment on table public.place_flags is
  'Places to look at, raised by a job (reason). A flag never changes a listing or a label. Service role only.';
