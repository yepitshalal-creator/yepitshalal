-- Three new search filters: food hygiene, open now, and price. Each one only
-- ever narrows to places we really know about. A place with no hygiene rating,
-- no opening hours or no price is left out while that filter is on, and never
-- counted as a 0, as closed or as cheap.
--
-- Additive only. search_candidates(), search_restaurants() and
-- search_radius_counts() gain three optional arguments, last and defaulting to
-- null, so every caller that does not pass them (the live site, app_search_v1)
-- behaves exactly as before. search_restaurants() also returns three new
-- columns at the end, which callers that do not read them ignore.

-- ============================================================================
-- Food hygiene ratings, from the Food Standards Agency's open data
-- ============================================================================
--
-- 6,850 searchable places already carry an FSA registration in
-- restaurant_source_links, but nothing kept the rating itself. The weekly job
-- (app/api/cron/hygiene-weekly) downloads the 33 London council files from
-- ratings.food.gov.uk/open-data (Open Government Licence) and writes one row
-- per place here. A place with more than one registration (153 of them) keeps
-- the one with the newest rating. A place with none has no row.

create table if not exists public.restaurant_hygiene (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  fhrs_id bigint not null,
  -- The FSA's own RatingValue: '0' to '5', or 'AwaitingInspection',
  -- 'AwaitingPublication', 'Exempt'. Kept as given.
  rating_label text not null,
  -- 0 to 5 when the label is a number, otherwise null. What the filter reads.
  rating smallint check (rating between 0 and 5),
  rating_date date,
  new_rating_pending boolean not null default false,
  local_authority text,
  -- When the weekly job last found something different for this place.
  changed_at timestamptz not null default now()
);

create index if not exists restaurant_hygiene_rating_idx
  on public.restaurant_hygiene (rating) where rating is not null;

alter table public.restaurant_hygiene enable row level security;
drop policy if exists restaurant_hygiene_public_read on public.restaurant_hygiene;
create policy restaurant_hygiene_public_read on public.restaurant_hygiene for select using (true);
-- Only the weekly job writes, with the service role.
revoke insert, update, delete, truncate on public.restaurant_hygiene from anon, authenticated;

-- ============================================================================
-- Price a head, from the owner
-- ============================================================================
--
-- 1 under £10, 2 £10 to £20, 3 over £20. Only ever set from what an owner
-- tells us: on their own page, or to us on a call. Never guessed from a menu,
-- a cuisine or a postcode.

alter table public.restaurants
  add column if not exists price_range smallint check (price_range between 1 and 3),
  add column if not exists price_range_source text check (price_range_source in ('owner', 'owner_by_phone')),
  add column if not exists price_range_at timestamptz;

-- ============================================================================
-- Open now
-- ============================================================================
--
-- The same rule as lib/openingStatus.ts, in London time: a row whose close
-- time is at or before its open time runs past midnight, and late Saturday
-- runs into early Sunday. Checked against the website's own answer for all 47
-- places with hours within a mile of Whitechapel on 2026-10-10: 34 open in
-- both, no difference.

create or replace function public.is_open_now(p_restaurant_id uuid, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  with t as (
    select (extract(dow from l) * 1440 + extract(hour from l) * 60 + extract(minute from l))::int as m
    from (select p_at at time zone 'Europe/London' as l) x
  ),
  iv as (
    select oh.day_of_week * 1440 + extract(epoch from oh.open_time) / 60 as s,
           oh.day_of_week * 1440 + extract(epoch from oh.close_time) / 60
             + case when oh.close_time <= oh.open_time then 1440 else 0 end as e
    from public.opening_hours oh
    where oh.restaurant_id = p_restaurant_id
      and not oh.is_closed and oh.open_time is not null and oh.close_time is not null
  )
  select exists (
    select 1 from iv, t
    where (t.m >= iv.s and t.m < iv.e) or (t.m + 10080 >= iv.s and t.m + 10080 < iv.e)
  );
$function$;

-- ============================================================================
-- Search: three more optional filters
-- ============================================================================

drop function if exists public.search_candidates(double precision, double precision, integer, text[], integer[], text, boolean);

create or replace function public.search_candidates(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer,
  p_classification text[] default null,
  p_cuisine_ids integer[] default null,
  p_query text default null,
  p_include_candidates boolean default false,
  p_min_hygiene integer default null,
  p_open_now boolean default null,
  p_price integer[] default null
)
returns table(id uuid, distance_meters double precision, relevance integer, halal_status text)
language sql
stable
set search_path to 'public'
as $function$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g,
           nullif(lower(btrim(p_query)), '') as q,
           replace(replace(replace(nullif(lower(btrim(p_query)), ''), '\', '\\'), '%', '\%'), '_', '\_') as pat
  ),
  places as (
    select r.*,
      case when r.halal_evidence_strength is null then 'unknown' else r.halal_classification::text end as status
    from public.restaurants r
    where case when p_include_candidates then r.is_searchable else r.is_listed end
  )
  select
    r.id,
    st_distance(r.location, o.g) as distance_meters,
    case
      when o.q is null then 0
      when lower(coalesce(b.name, r.name)) like o.pat || '%' then 3
      when lower(r.name) like '%' || o.pat || '%' or lower(coalesce(b.name, '')) like '%' || o.pat || '%' then 2
      else 1
    end as relevance,
    r.status
  from places r
  left join public.brands b on b.id = r.brand_id
  cross join origin o
  where st_dwithin(r.location, o.g, p_radius_meters)
    and (p_classification is null or r.status = any (p_classification))
    and (
      p_cuisine_ids is null
      or exists (select 1 from public.restaurant_cuisines rc where rc.restaurant_id = r.id and rc.cuisine_id = any (p_cuisine_ids))
    )
    and (
      p_min_hygiene is null
      or exists (select 1 from public.restaurant_hygiene h where h.restaurant_id = r.id and h.rating >= p_min_hygiene)
    )
    and (p_open_now is not true or public.is_open_now(r.id))
    and (p_price is null or r.price_range = any (p_price))
    and (
      o.q is null
      or lower(r.name) like '%' || o.pat || '%'
      or lower(coalesce(b.name, '')) like '%' || o.pat || '%'
      or lower(coalesce(r.branch_label, '')) like '%' || o.pat || '%'
      or lower(coalesce(r.cuisine_label, '')) like '%' || o.pat || '%'
      or exists (
        select 1 from public.restaurant_cuisines rc
        join public.cuisines c on c.id = rc.cuisine_id
        where rc.restaurant_id = r.id and lower(c.name) like '%' || o.pat || '%'
      )
    );
$function$;

-- As before: only the security definer functions below may run it.
revoke all on function public.search_candidates(double precision, double precision, integer, text[], integer[], text, boolean, integer, boolean, integer[]) from public, anon, authenticated;
grant execute on function public.search_candidates(double precision, double precision, integer, text[], integer[], text, boolean, integer, boolean, integer[]) to service_role;

drop function if exists public.search_radius_counts(double precision, double precision, integer[], text[], integer[], text, boolean);

create or replace function public.search_radius_counts(
  p_lat double precision,
  p_lng double precision,
  p_radii integer[],
  p_classification text[] default null,
  p_cuisine_ids integer[] default null,
  p_query text default null,
  p_include_candidates boolean default false,
  p_min_hygiene integer default null,
  p_open_now boolean default null,
  p_price integer[] default null
)
returns table(radius_meters integer, places bigint, with_evidence bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.r, x.places, x.with_evidence
  from unnest(p_radii) as t(r)
  cross join lateral (
    select count(*) as places, count(*) filter (where c.halal_status <> 'unknown') as with_evidence
    from public.search_candidates(p_lat, p_lng, t.r, p_classification, p_cuisine_ids, p_query, p_include_candidates,
      p_min_hygiene, p_open_now, p_price) c
  ) x
  order by t.r;
$function$;

grant execute on function public.search_radius_counts(double precision, double precision, integer[], text[], integer[], text, boolean, integer, boolean, integer[]) to anon, authenticated, service_role;

drop function if exists public.search_restaurants(double precision, double precision, integer, text, text[], integer[], text, integer, integer, text, boolean);

create or replace function public.search_restaurants(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer,
  p_mode text default 'current_location',
  p_classification text[] default null,
  p_cuisine_ids integer[] default null,
  p_query text default null,
  p_limit integer default 500,
  p_offset integer default 0,
  p_sort text default 'distance',
  p_include_candidates boolean default false,
  p_min_hygiene integer default null,
  p_open_now boolean default null,
  p_price integer[] default null
)
returns table(
  id uuid, name text, slug text, address text, lat double precision, lng double precision,
  halal_classification text, distance_meters double precision, primary_photo_path text,
  cuisines text[], effective_radius_meters integer, is_yep_plus boolean, brand_name text,
  branch_label text, halal_evidence_strength text, halal_summary text, cuisine_label text,
  opening_hours jsonb, total_count bigint, halal_status text, postcode text, checked_by_us boolean,
  hygiene_rating smallint, hygiene_rating_date date, price_range smallint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_is_supporter boolean := public.is_current_user_yep_plus();
  v_radius int;
begin
  v_radius := least(coalesce(p_radius_meters, 1609), 80467);

  return query
  select
    r.id, r.name, r.slug, r.address,
    st_y(r.location::geometry), st_x(r.location::geometry),
    r.halal_classification::text,
    c.distance_meters,
    (select rp.storage_path from public.restaurant_photos rp
      where rp.restaurant_id = r.id and rp.is_primary limit 1),
    (select array_agg(cu.name order by cu.name) from public.restaurant_cuisines rc
      join public.cuisines cu on cu.id = rc.cuisine_id where rc.restaurant_id = r.id),
    v_radius, v_is_supporter,
    b.name, r.branch_label,
    r.halal_evidence_strength::text, r.halal_summary, r.cuisine_label,
    (select jsonb_agg(jsonb_build_object('day_of_week', oh.day_of_week, 'open_time', oh.open_time, 'close_time', oh.close_time, 'is_closed', oh.is_closed))
      from public.opening_hours oh where oh.restaurant_id = r.id),
    count(*) over (),
    c.halal_status,
    r.postcode,
    r.checked_by_us,
    h.rating,
    h.rating_date,
    r.price_range
  from public.search_candidates(p_lat, p_lng, v_radius, p_classification, p_cuisine_ids, p_query, p_include_candidates,
    p_min_hygiene, p_open_now, p_price) c
  join public.restaurants r on r.id = c.id
  left join public.brands b on b.id = r.brand_id
  left join public.restaurant_hygiene h on h.restaurant_id = r.id
  order by
    case when p_query is not null and btrim(p_query) <> '' then -c.relevance else 0 end,
    case when p_sort = 'evidence' then
      case c.halal_status when 'fully_halal' then 0 when 'halal_options' then 1 when 'unverified' then 2 else 3 end
    else 0 end,
    c.distance_meters asc,
    r.id
  limit greatest(least(coalesce(p_limit, 500), 1000), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

grant execute on function public.search_restaurants(double precision, double precision, integer, text, text[], integer[], text, integer, integer, text, boolean, integer, boolean, integer[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
