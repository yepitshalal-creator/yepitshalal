import type { Metadata } from 'next';
import Link from 'next/link';
import { heroPrimary, heroSecondary } from '@/components/PageHero';
import { notFound } from 'next/navigation';
import { HalalBadge } from '@/components/HalalBadge';
import { NotifyMeForm } from '@/components/NotifyMeForm';
import { ArrowRightIcon, InfoIcon, MapPinIcon } from '@/components/icons';
import { ctaSecondary } from '@/components/cta';
import { forestLights } from '@/components/grounds';
import { getAreasWithPages } from '@/lib/areas';
import { getCuisines } from '@/lib/cuisines';
import { hreflangAlternates, localeByCode, LOCALES } from '@/lib/locales';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import type { HalalStatus } from '@/lib/types';

export const revalidate = 86400;
export const dynamicParams = false;

// One page per language, at its own URL, because that is the only form of
// "other languages" a search engine acts on.
//
// It explains the site and its vocabulary in the reader's language and then
// hands them over to the English directory, which is where the actual answers
// are. It does not pretend the listings are translated: see lib/locales for
// why translating eleven thousand quotations about somebody else's meat is the
// one thing this site must not do.

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const locale = localeByCode(params.lang);
  if (!locale) return { title: 'Not found', robots: { index: false } };
  return {
    title: locale.title,
    description: locale.description,
    alternates: {
      canonical: `/${locale.code}`,
      languages: hreflangAlternates(SITE_URL),
    },
    openGraph: { title: locale.title, description: locale.description, locale: locale.code },
  };
}

/** The three labels, in the order the English pages show them. */
const ORDER: HalalStatus[] = ['fully_halal', 'halal_options', 'unverified'];

export default async function LocalePage({ params }: { params: { lang: string } }) {
  const locale = localeByCode(params.lang);
  if (!locale) notFound();

  const [areas, cuisines] = await Promise.all([getAreasWithPages(), getCuisines()]);
  const topAreas = [...areas].sort((a, b) => b.listed - a.listed).slice(0, 10);
  const topCuisines = cuisines.slice(0, 8);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/${locale.code}`,
    url: `${SITE_URL}/${locale.code}`,
    name: locale.title,
    description: locale.description,
    inLanguage: locale.code,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@type': 'Thing', name: 'Halal restaurants in London' },
  };

  return (
    // lang and dir live on the wrapper rather than <html>, which belongs to the
    // root layout. Screen readers switch voice on it and right-to-left text
    // lays out correctly; the header and footer around it stay English, which
    // is honest, because so is the rest of the site.
    <div lang={locale.code} dir={locale.dir}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />

      <section className="ground-dark grain relative overflow-hidden bg-forest-deep">
        <div aria-hidden="true" className={`absolute inset-0 ${forestLights}`} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-sand-soft" />

        <div className="relative mx-auto max-w-3xl px-5 pb-12 pt-10 text-center sm:px-6 sm:pb-16 sm:pt-16">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full bg-white/12 py-1 pl-1 pr-3.5 text-xs text-white ring-1 ring-white/20">
            {/* No letter-spacing and no uppercasing in Arabic script: tracking
                pulls joined letters apart, and there is no case to raise. */}
            <span
              className={
                locale.dir === 'rtl'
                  ? 'rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold leading-normal text-forest-deep'
                  : 'rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-forest-deep'
              }
            >
              {locale.beta}
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <MapPinIcon className="h-3.5 w-3.5" />
              London
            </span>
          </span>

          <h1 className="mt-5 text-balance font-display text-[2.4rem] font-semibold leading-[1.08] text-white sm:text-5xl">
            {locale.h1}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-white/85">
            {locale.intro}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className={heroPrimary}>
              {locale.ctaSearch}
              <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/how-we-check"
              className={heroSecondary}
            >
              {locale.ctaHow}
            </Link>
          </div>

          {/* Said before anything else, because a reader who does not find out
              until the third click has been misled by omission. */}
          <p className="mx-auto mt-7 flex max-w-xl items-start gap-2 rounded-xl bg-white/10 p-3.5 text-start text-[13.5px] leading-relaxed text-white/85 ring-1 ring-white/15">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{locale.englishNote}</span>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-14">
        <h2 className="text-balance font-display text-2xl font-semibold text-ink sm:text-3xl">
          {locale.labelsHeading}
        </h2>
        {/* Every label is given twice: in this language, and in the English the
            badge actually shows, so the reader recognises it when they get
            there. */}
        <dl className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          {ORDER.map((classification, i) => {
            const label = locale.labels[i];
            return (
              <div key={classification} className="px-5 py-4">
                <dt className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-display text-[17px] font-semibold text-ink">{label.name}</span>
                  <span dir="ltr">
                    <HalalBadge classification={classification} size="sm" />
                  </span>
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{label.body}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="border-y border-sand-line bg-sand">
        <div className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-14">
          <h2 className="text-balance font-display text-2xl font-semibold text-ink sm:text-3xl">
            {locale.evidenceHeading}
          </h2>
          <ul className="mt-5 space-y-3">
            {locale.evidence.map((line) => (
              <li key={line} className="rounded-xl bg-white px-4 py-3 text-sm leading-relaxed text-ink/80 shadow-sm">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-14">
        <h2 className="text-balance font-display text-2xl font-semibold text-ink sm:text-3xl">
          {locale.browseHeading}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{locale.browseBody}</p>

        {/* The destinations are English pages, so their names stay English and
            read left to right even inside a right-to-left page. */}
        <ul dir="ltr" className="mt-5 flex flex-wrap gap-2">
          {topAreas.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/halal-restaurants/${a.slug}`}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[13.5px] font-medium text-ink/80 transition hover:border-ink/30 hover:text-ink"
              >
                {a.borough}
                <span className="text-subtle">{a.listed}</span>
              </Link>
            </li>
          ))}
        </ul>

        <ul dir="ltr" className="mt-3 flex flex-wrap gap-2">
          {topCuisines.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/halal-restaurants/cuisine/${c.slug}`}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-spice/20 bg-white px-3.5 text-[13.5px] font-medium text-ink transition hover:border-spice/45 hover:bg-spice-soft"
              >
                Halal {c.cuisine}
                <span className="text-subtle">{c.listed}</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-5">
          <Link href="/" className={ctaSecondary}>
            {locale.ctaSearch}
          </Link>
        </p>
      </section>

      <section className="border-t border-line bg-sand-soft">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-14">
          <h2 className="text-balance font-display text-2xl font-semibold text-ink sm:text-3xl">
            {locale.notifyHeading}
          </h2>
          <p className="mt-2.5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted">{locale.notifyBody}</p>
          <div className="mt-5 max-w-xl">
            <NotifyMeForm
              source={`locale page ${locale.code}`}
              locale={locale.code}
              buttonLabel={locale.notifyButton}
              placeholder={locale.notifyEmailPlaceholder}
              cityPlaceholder={locale.notifyCityPlaceholder}
              emailLabel={locale.notifyEmailLabel}
              cityLabel={locale.notifyCityLabel}
              sendingLabel={locale.notifySending}
              doneTitle={locale.notifyDoneTitle}
              doneBody={locale.notifyDoneBody}
              privacyLine={locale.notifyPrivacy}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
