// The admin's sections. Since 2026-10-10 pages that do one job share one item
// in the sidebar and sit as tabs along the top of each other: Restaurants
// holds new restaurants, duplicates and coverage, and so on. Every page keeps
// its own address, so old links still work. The sidebar (AdminNav) and the
// tabs (SectionTabs) both read this list, so they cannot disagree.

/** The numbers a tab or sidebar item can show: what is waiting on somebody. */
export type CountKey =
  | 'messages'
  | 'submissions'
  | 'duplicates'
  | 'checks'
  | 'claims'
  | 'founders'
  | 'reels'
  | 'deals'
  | 'outreach'
  | 'setup';

export interface Tab {
  href: string;
  label: string;
  count?: CountKey;
}

export interface Section {
  label: string;
  tabs: Tab[];
}

export type SectionId = 'analytics' | 'restaurants' | 'checks' | 'partners' | 'deals';

export const SECTIONS: Record<SectionId, Section> = {
  analytics: {
    label: 'Analytics',
    tabs: [
      { href: '/admin/analytics', label: 'Visitors' },
      { href: '/admin/demand', label: 'Where to go next' },
    ],
  },
  restaurants: {
    label: 'Restaurants',
    tabs: [
      { href: '/admin/restaurants', label: 'All restaurants' },
      { href: '/admin/submissions', label: 'New', count: 'submissions' },
      { href: '/admin/duplicates', label: 'Duplicates', count: 'duplicates' },
      { href: '/admin/coverage', label: 'Coverage' },
    ],
  },
  checks: {
    label: 'Halal checks',
    tabs: [
      { href: '/admin/queue', label: 'Requests', count: 'checks' },
      { href: '/admin/verify', label: 'What to check next' },
      { href: '/admin/certification', label: 'Certificate claims' },
    ],
  },
  partners: {
    label: 'Owners and partners',
    tabs: [
      { href: '/admin/claims', label: 'Ownership claims', count: 'claims' },
      { href: '/admin/outreach', label: 'Outreach', count: 'outreach' },
      { href: '/admin/founders', label: 'Founders', count: 'founders' },
      { href: '/admin/reels', label: 'Reels', count: 'reels' },
    ],
  },
  deals: {
    label: 'Deals and offers',
    tabs: [
      { href: '/admin/deals', label: 'Deals and credit', count: 'deals' },
      { href: '/admin/offers', label: 'Offers' },
    ],
  },
};

/** Is this address the tab's page, or a page below it (a single record)? */
export function onTab(path: string, href: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}
