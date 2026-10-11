import Link from 'next/link';
import { ArrowUpRightIcon, ClockIcon, MapPinIcon, NavigationIcon, PhoneIcon } from './icons';
import { NearestMosqueButton } from './NearestMosqueButton';
import { PrayerAtRestaurant } from './PrayerAtRestaurant';
import { formatUkPhone, splitPhones } from '@/lib/phone';
import { formatMetres, formatOsmHours, walkingMinutes, type PrayerSpace } from '@/lib/prayerSpaces';

// "If I eat here, where do I pray?"
//
// Two answers in one section, in the order you would ask them: whether there
// is anywhere inside the restaurant, and failing that, what is nearby. The one
// place the prayer spaces meet the restaurants. It makes no claim about the
// food and the food makes no claim about it: this is a mosque that happens to
// be near, nothing more.
//
// The walk is an estimate from a straight-line distance and says so. A precise
// number would need a routing service we do not run, and a precise-looking
// number we cannot stand behind is worse than an honest "about".

export function NearestPrayerSpace({
  spaces,
  placeName,
  slug,
  facility = null,
  facilityNote = null,
  facilitySource = null,
  facilityAt = null,
}: {
  spaces: PrayerSpace[];
  placeName: string;
  slug: string;
  facility?: 'prayer_room' | 'space' | 'none' | null;
  facilityNote?: string | null;
  facilitySource?: string | null;
  facilityAt?: string | null;
}) {
  const [nearest, ...rest] = spaces;
  const hours = formatOsmHours(nearest?.opening_hours ?? null);
  const services = formatOsmHours(nearest?.service_times ?? null);
  const phone = nearest ? splitPhones(nearest.phone)[0] ?? null : null;

  return (
    <section aria-labelledby="prayer" className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 id="prayer" className="font-display text-lg font-semibold text-ink">
        Somewhere to pray
      </h2>

      <PrayerAtRestaurant
        facility={facility}
        note={facilityNote}
        source={facilitySource}
        at={facilityAt}
        slug={slug}
        placeName={placeName}
      />

      {!nearest ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          We don&apos;t know of a mosque within a couple of miles of here. That does not mean there
          isn&apos;t one.
        </p>
      ) : (
        <>
        <p className="mt-5 text-sm text-muted">
          The closest mosque we know of to {placeName}. Distances are in a straight line, so treat the
          walk as a rough idea.
        </p>

        <div className="mt-3 rounded-xl bg-sand p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-display text-base font-semibold text-ink">{nearest.name}</p>
            <p className="text-sm font-semibold text-accent-ink">
              about {walkingMinutes(nearest.distance_meters)} min walk
            </p>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {formatMetres(nearest.distance_meters)} away
            {nearest.address && ` · ${nearest.address}`}
            {!nearest.address && nearest.postcode && ` · ${nearest.postcode}`}
          </p>

          {/* Only when a mapper recorded them, and phrased as what the map says
              rather than what is true: a mosque listed as open may be locked. */}
          {(hours || services) && (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-ink/75">
              <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
              <span>
                {hours && <>Listed as open {hours}. </>}
                {services && <>Prayer times listed as {services}. </>}
                <span className="text-subtle">Worth confirming before you set off.</span>
              </span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${nearest.lat},${nearest.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-accent-ink hover:underline"
            >
              <NavigationIcon className="h-4 w-4" aria-hidden="true" />
              Directions
            </a>
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 font-semibold text-accent-ink hover:underline"
              >
                <PhoneIcon className="h-4 w-4" aria-hidden="true" />
                {formatUkPhone(phone)}
              </a>
            )}
            {nearest.website_url && (
              <a
                href={nearest.website_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink hover:underline"
              >
                Their website
                <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {rest.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {rest.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 break-words text-ink/80">{s.name}</span>
                <span className="shrink-0 text-muted">about {walkingMinutes(s.distance_meters)} min</span>
              </li>
            ))}
          </ul>
        )}
        </>
      )}

      <div className="mt-4">
        <NearestMosqueButton label="Find the nearest to me" variant="quiet" />
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-subtle">
        <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          From OpenStreetMap, and not checked by us. Hardly any of these carry opening times, and a
          mosque listed as open may still be locked, so ring ahead for a particular prayer.{' '}
          <Link href="/prayer-spaces" className="font-medium text-accent-ink hover:underline">
            All prayer spaces
          </Link>
        </span>
      </p>
    </section>
  );
}
