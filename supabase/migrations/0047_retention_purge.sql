-- Enforce the retention periods published on /privacy.
--
-- /privacy promises that IP hashes are kept for 12 months and that what people
-- write to us is kept for two years. A published retention period that nothing
-- enforces is a false statement about personal data, which is exactly what the
-- page exists to avoid. This makes both numbers true.
--
-- Written 2026-09-21, applied live on 2026-10-24 (not the same day, as this
-- once said). Every table below had 0 rows on both dates, so the first run
-- that clears anything is late 2027.
--
-- Why most rules clear columns instead of deleting rows:
--
--   site_feedback           Deleted after two years. Every field is personal.
--
--   language_requests       Email removed after two years, the vote kept. How
--                           many people asked for a language is not personal,
--                           and it is the whole reason the table exists.
--
--   restaurant_submissions  Contact name, email and notes removed after two
--                           years. The business details and the halal evidence
--                           stay: they are not personal data, and they are the
--                           record of why a place was listed, which is what
--                           answers a dispute about a label. Deleting them
--                           would throw away the defence the corrections page
--                           relies on.
--
--   ip_hash, everywhere     Cleared after 12 months.
--
-- verification_requests keeps its rows. It is a paid service, and payment
-- records are kept as long as tax rules require. Only its hash expires.

create or replace function public.purge_expired_personal_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 12 months: the IP hashes.
  update public.restaurant_submissions set ip_hash = null
    where ip_hash is not null and created_at < now() - interval '12 months';
  update public.site_feedback set ip_hash = null
    where ip_hash is not null and created_at < now() - interval '12 months';
  update public.language_requests set ip_hash = null
    where ip_hash is not null and created_at < now() - interval '12 months';
  update public.subscribers set ip_hash = null
    where ip_hash is not null and created_at < now() - interval '12 months';
  -- verification_requests dates its rows by when they entered the queue.
  update public.verification_requests set ip_hash = null
    where ip_hash is not null and entered_queue_at < now() - interval '12 months';

  -- Two years: what people wrote to us.
  delete from public.site_feedback
    where created_at < now() - interval '2 years';
  update public.language_requests set email = null
    where email is not null and created_at < now() - interval '2 years';
  update public.restaurant_submissions
    set contact_name = null, contact_email = null, notes = null
    where created_at < now() - interval '2 years'
      and (contact_name is not null or contact_email is not null or notes is not null);
end;
$$;

comment on function public.purge_expired_personal_data() is
  'Enforces the retention periods on /privacy. Run daily by pg_cron. Change /privacy and this together, never one without the other.';

-- Nobody outside the database calls this. pg_cron runs it as postgres.
revoke all on function public.purge_expired_personal_data() from public, anon, authenticated;

create extension if not exists pg_cron;

-- Daily at 03:17 UTC. An odd minute, so it does not queue behind every other
-- job on the hour. Scheduling by name makes a second run of this migration
-- update the job rather than add a duplicate.
select cron.schedule(
  'purge-expired-personal-data',
  '17 3 * * *',
  $cmd$select public.purge_expired_personal_data();$cmd$
);
