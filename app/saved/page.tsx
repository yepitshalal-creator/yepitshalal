import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { SavedList } from '@/components/SavedList';
import { inlineLink, pageShell } from '@/components/prose';

// The phone's fourth tab since the 2026-10-12 plan (Step 3). It was Account,
// which led most visitors to a sign-in page they had no use for. Saving needs
// no account: the list is kept on the phone (lib/saved.ts). Signing in is for
// restaurant owners and supporters, and is one tap on from here.

export const metadata: Metadata = {
  title: 'Saved places',
  description: 'The halal places you saved, kept on this phone.',
  // Different for every visitor and empty to a crawler.
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <>
      <PageHero tone="sand" title="Saved places" lede="Places you saved, kept on this phone." />
      <div className={`${pageShell} pb-10 pt-8 sm:pt-10`}>
        <SavedList />
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
          Run a restaurant or support us?{' '}
          <Link href="/account" className={inlineLink}>
            Your account
          </Link>
        </p>
      </div>
    </>
  );
}
