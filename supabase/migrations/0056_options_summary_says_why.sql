-- The one-line reason a "Halal food available" place shows, on cards, lists,
-- its page and its "Is it halal?" answer, now says why it is not Fully Halal.
--
-- Until now every first-party halal_options row read "The restaurant says some
-- of its food is halal", whatever the restaurant had said. On 2026-10-24
-- Shabir decided a place that serves alcohol is never Fully Halal, and 83
-- places moved, most of them restaurants that say all their food is halal and
-- also sell beer or wine (Thunderbird: "Every single thing we serve is
-- Halal"). "Some of its food" was false for them. The pipeline already keeps
-- the reason on each evidence row ("The same website also mentions alcohol.",
-- "The website says diners may bring their own alcohol."), so the summary now
-- uses it: "The restaurant says it serves halal food. The same website also
-- mentions alcohol".
--
-- Only a reason about alcohol. The other reasons ("The same website also
-- mentions pork.") come from word matches nobody has read, and no visitor has
-- ever been shown them; publishing them would be a new claim about some 400
-- places that was never asked for. "Some of its food is halal" stays true for
-- those places, so they keep it.
--
-- Everything else is 0031's function unchanged. Summaries carry no final full
-- stop; the site adds it.

create or replace function public.refresh_halal_status(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class halal_classification := 'unverified';
  v_best record;
  v_negative boolean;
  v_summary text;
begin
  select exists (
    select 1 from restaurant_halal_evidence
    where restaurant_id = p_restaurant_id and is_current
      and claim = 'not_halal' and strength in ('strong', 'moderate')
  ) into v_negative;

  if exists (
    select 1 from restaurant_halal_evidence
    where restaurant_id = p_restaurant_id and is_current
      and claim = 'fully_halal' and strength = 'strong'
  ) then
    v_class := 'fully_halal';
  elsif exists (
    select 1 from restaurant_halal_evidence
    where restaurant_id = p_restaurant_id and is_current
      and claim = 'halal_options' and strength in ('strong', 'moderate')
  ) then
    v_class := 'halal_options';
  end if;

  select e.* into v_best
  from restaurant_halal_evidence e
  where e.restaurant_id = p_restaurant_id and e.is_current and e.claim <> 'not_halal'
    and (
      v_class = 'unverified'
      or (v_class = 'fully_halal' and e.claim = 'fully_halal' and e.strength = 'strong')
      or (v_class = 'halal_options' and e.claim = 'halal_options' and e.strength in ('strong', 'moderate'))
    )
  order by
    case e.strength when 'strong' then 1 when 'moderate' then 2 else 3 end,
    case e.kind::text
      when 'yepitshalal_check' then 1 when 'certification' then 2 when 'first_party_statement' then 3
      when 'certification_claim' then 4 when 'business_name' then 5 when 'community_tag' then 6
      when 'directory_category' then 7 when 'owner_submission' then 8 else 9 end,
    e.checked_at desc
  limit 1;

  if v_negative or v_best.id is null then
    update restaurants
      set halal_classification = 'unverified',
          halal_evidence_strength = null,
          halal_summary = case when v_negative then 'Evidence suggests this place is not halal' else null end,
          halal_checked_at = null,
          has_negative_evidence = v_negative
    where id = p_restaurant_id;
    return;
  end if;

  v_summary := case v_best.kind::text
    when 'yepitshalal_check' then 'Checked by YepItsHalal'
    when 'certification' then 'Certified by ' || v_best.source_name
    when 'first_party_statement' then case v_best.claim
      when 'fully_halal' then 'The restaurant says all its meat is halal'
      when 'halal_options' then case
        when v_best.notes ilike '%alcohol%'
          then 'The restaurant says it serves halal food. ' || rtrim(btrim(v_best.notes), '.')
        else 'The restaurant says some of its food is halal' end
      else 'The restaurant''s website mentions halal food' end
    when 'certification_claim' then 'The restaurant says it is halal certified'
    when 'business_name' then 'Its business name says halal'
    when 'community_tag' then 'Tagged halal on OpenStreetMap'
    when 'directory_category' then 'Listed as halal in public place data'
    when 'owner_submission' then 'Details from the owner, not yet checked'
    when 'public_submission' then 'Suggested by a customer, not yet checked'
  end;

  update restaurants
    set halal_classification = v_class,
        halal_evidence_strength = v_best.strength,
        halal_summary = v_summary,
        halal_checked_at = v_best.checked_at,
        has_negative_evidence = false
  where id = p_restaurant_id;
end;
$$;

-- Rewrite the summary of every place the change touches. The label itself
-- cannot move: the function reads the same evidence it read before.
select public.refresh_halal_status(r.id)
from public.restaurants r
where r.halal_classification = 'halal_options'
  and exists (
    select 1 from public.restaurant_halal_evidence e
    where e.restaurant_id = r.id and e.is_current
      and e.kind = 'first_party_statement' and e.claim = 'halal_options'
      and e.notes ilike '%alcohol%'
  );
