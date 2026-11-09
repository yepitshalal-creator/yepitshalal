import type { Metadata } from 'next';
import Link from 'next/link';
import { ctaPrimary, ctaSecondary } from '@/components/cta';
import { ArrowRightIcon } from '@/components/icons';
import { PageHero } from '@/components/PageHero';
import { SHUTTER_DOWN } from '@/lib/media';
import { pageShell } from '@/components/prose';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <PageHero
        art={SHUTTER_DOWN}
        title="We couldn't find that page"
        lede="The link may be old, or the place may have been merged with another listing. Search for it by name or postcode instead."
      />
      <div className={`${pageShell} pb-8 pt-8`}>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className={`${ctaPrimary} group`}>
            Search
            <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link href="/halal-restaurants" className={ctaSecondary}>
            Browse by borough
          </Link>
        </div>
      </div>
    </>
  );
}
