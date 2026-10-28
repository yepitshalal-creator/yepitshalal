import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { SubmitRestaurantForm, type ExistingPlace } from '@/components/SubmitRestaurantForm';
import { cleanRestaurantName } from '@/lib/restaurantName';
import { formatUkPhone, splitPhones } from '@/lib/phone';
import { PageHero } from '@/components/PageHero';
import { PageBody } from '@/components/PageLayout';
import { inlineLink } from '@/components/prose';
import { Free } from '@/components/Free';
import { STREET } from '@/lib/media';

export function generateMetadata({ searchParams }: { searchParams: { update?: string } }): Metadata {
  return {
    title: searchParams.update ? 'Suggest an edit' : 'Add a restaurant',
    description:
      'Tell us about a halal restaurant in London, or suggest an edit to one we list. We check every submission before it appears.',
    alternates: { canonical: '/submit-restaurant' },
    // One page per listing would be a thousand copies of the same form.
    robots: searchParams.update ? { index: false, follow: true } : undefined,
  };
}

function streetPart(address: string, postcode: string | null): string {
  // Our placeholder for a missing street address is not an address to prefill.
  if (/street address not known/i.test(address)) return '';
  if (!postcode) return address;
  const i = address.toUpperCase().lastIndexOf(postcode.toUpperCase());
  return (i > 0 ? address.slice(0, i) : address).replace(/[,\s]+$/, '');
}

export default async function SubmitRestaurantPage({ searchParams }: { searchParams: { update?: string } }) {
  const supabase = createServerSupabase();
  const [{ data: cuisines }, { data: place }] = await Promise.all([
    supabase.from('cuisines').select('id, name').order('name'),
    searchParams.update
      ? supabase
          .from('restaurants')
          .select('slug, name, address, postcode, phone, website_url, cuisine_label')
          .eq('slug', searchParams.update)
          .is('merged_into', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const existing: ExistingPlace | null = place
    ? {
        slug: place.slug,
        name: cleanRestaurantName(place.name),
        address: streetPart(place.address, place.postcode),
        postcode: place.postcode ?? '',
        phone: splitPhones(place.phone).map(formatUkPhone).join(', '),
        website: place.website_url ?? '',
        cuisine: place.cuisine_label ?? '',
      }
    : null;

  return (
    <>
      <PageHero
        crumbs={existing ? [{ label: existing.name, href: `/restaurant/${existing.slug}` }, { label: 'Suggest an edit' }] : undefined}
        title={existing ? `Suggest an edit for ${existing.name}` : 'Add a restaurant'}
        // The same street as the homepage and Discover (2026-09-24): finding
        // places, adding them and the catalogue growing are one story. Kept
        // to the header, well above the form. Editing a listing is a
        // correction, not an invitation, so it gets no picture.
        art={existing ? undefined : STREET}
        lede={
          existing ? (
            <>
              Correct or add anything you know, including whether it serves halal food. We check every
              suggestion before it changes the{' '}
              <Link href={`/restaurant/${existing.slug}`} className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
                listing
              </Link>
              .
            </>
          ) : (
            <>
              Know a halal place we&apos;re missing, or run one? Adding it is <Free tone="dark">free</Free>,
              and every place added helps the next person looking. We check
              each one before it goes live, and show where its halal information came from.
            </>
          )
        }
      />

      <PageBody aside={<WhatHappensNext editing={!!existing} />} asideOnPhone="hide">
        <SubmitRestaurantForm cuisines={cuisines ?? []} existing={existing} />
      </PageBody>
    </>
  );
}

/**
 * Beside the form on wide screens: what the form already promises, gathered
 * where somebody filling it in can see it. Every line here is said elsewhere
 * on the site; nothing new is promised.
 */
function WhatHappensNext({ editing }: { editing: boolean }) {
  const steps = [
    editing
      ? 'We check every suggestion before it changes a listing.'
      : 'We check every restaurant before it appears on YepItsHalal.',
    'How we check: we ring and ask.',
    'A listing built on a form alone never shows as more than Unverified. Not until something stronger arrives.',
    'If you left an email, we may get in touch with a question.',
  ];
  return (
    <div className="rounded-2xl bg-sand p-5 ring-1 ring-sand-line">
      <p className="font-display text-base font-semibold text-ink">What happens next</p>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3 text-sm leading-relaxed text-ink/80">
            <span
              aria-hidden="true"
              className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums text-spice-ink ring-1 ring-sand-line"
            >
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-sand-line pt-4 text-sm text-muted">
        <Link href="/how-we-check" className={inlineLink}>
          How we label places
        </Link>
      </p>
    </div>
  );
}
