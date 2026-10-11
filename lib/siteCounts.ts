import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

// How many places the site can show, said on the homepage and the owners
// page (Shabir, 2026-10-11: the number of restaurants in our database, on the
// website). The same rule as search and the admin's catalogue card:
// is_searchable (migration 0031). "With halal evidence" is a place with any
// evidence at all, as in the count on a search. Most places are Worth asking,
// so the words are "places", never "halal restaurants".
//
// Kept an hour, like the area pages. A failure is thrown, not kept, and the
// pages then leave the line out rather than show a wrong number.

export interface SiteCounts {
  places: number;
  withEvidence: number;
}

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

const fetchCounts = unstable_cache(
  async (): Promise<SiteCounts> => {
    const db = publicClient();
    const searchable = () =>
      db.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_searchable', true);
    const [all, evidence] = await Promise.all([searchable(), searchable().not('halal_evidence_strength', 'is', null)]);
    if (all.error || evidence.error || all.count == null || evidence.count == null) {
      throw new Error(all.error?.message ?? evidence.error?.message ?? 'no count');
    }
    return { places: all.count, withEvidence: evidence.count };
  },
  ['site-counts-v1'],
  { revalidate: 3600 }
);

export async function getSiteCounts(): Promise<SiteCounts | null> {
  try {
    return await fetchCounts();
  } catch {
    return null;
  }
}

/** 11801 as "11,801". */
export const formatCount = (n: number) => n.toLocaleString('en-GB');
