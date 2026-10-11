import type { MetadataRoute } from 'next';
import { getAreasWithPages } from '@/lib/areas';
import { getCuisines } from '@/lib/cuisines';
import { getChainIndex, getListedSlugs } from '@/lib/halalPages';
import { SITE_URL as siteUrl } from '@/lib/site';
import { LOCALES } from '@/lib/locales';

export const revalidate = 3600;

// Only pages worth landing on. Search results and Discover (still a holding
// page) are left out.
//
// Every place in search has an "Is it halal?" page here, and every chain with a
// page: rebuilt from the database every hour, so a place added later is listed
// without anybody touching this file. Search holds only places with halal
// evidence since 2026-10-11 (from 2026-09-24 it also held the ones nobody had
// checked); a listing taken out of search (sent to review, closed, merged)
// drops out of both.

/**
 * When the fixed pages last actually changed. Bump it when one of them does.
 *
 * A crawler has no other way to know the homepage was rewritten, and a sitemap
 * that claims a change every hour (build time would) gets its dates ignored,
 * so this is a date somebody sets on purpose.
 */
const CONTENT_UPDATED = new Date('2026-09-24');
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [areas, places, cuisines, chains] = await Promise.all([
    getAreasWithPages(),
    getListedSlugs(),
    getCuisines(),
    getChainIndex(),
  ]);

  return [
    { url: `${siteUrl}/`, lastModified: CONTENT_UPDATED, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/halal-restaurants`, lastModified: CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    // The translated landing pages. Each one is a real page in its own
    // language, not a copy of an English one, so each is worth crawling.
    ...LOCALES.map((l) => ({
      url: `${siteUrl}/${l.code}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: `${siteUrl}/halal-restaurants/cuisine`, lastModified: CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/prayer-spaces`, lastModified: CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/how-we-check`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/image-credits`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.2 },
    // Worth crawling even though nobody searches for them: an owner looking for
    // a way to dispute a label often arrives from a search engine, not the site.
    { url: `${siteUrl}/corrections`, lastModified: CONTENT_UPDATED, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/privacy`, lastModified: CONTENT_UPDATED, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/terms`, lastModified: CONTENT_UPDATED, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/submit-restaurant`, lastModified: CONTENT_UPDATED, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/yep-plus`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/partners`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/owners`, changeFrequency: 'monthly', priority: 0.4 },
    ...areas.map((a) => ({
      url: `${siteUrl}/halal-restaurants/${a.slug}`,
      ...(a.last_checked_at ? { lastModified: new Date(a.last_checked_at) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...cuisines.map((c) => ({
      url: `${siteUrl}/halal-restaurants/cuisine/${c.slug}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...places.map((r) => ({
      url: `${siteUrl}/restaurant/${r.slug}`,
      ...(r.updated ? { lastModified: new Date(r.updated) } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: `${siteUrl}/is-it-halal`, lastModified: CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    ...chains.map((c) => ({
      url: `${siteUrl}/is-it-halal/chain/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...places.map((p) => ({
      url: `${siteUrl}/is-it-halal/${p.slug}`,
      ...(p.updated ? { lastModified: new Date(p.updated) } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
