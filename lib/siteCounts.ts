import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

// How many places the site shows, said on the homepage and the owners page
// (Shabir, 2026-10-11: the number of restaurants in our database, on the
// website). The same rule as search: is_listed, a place with halal evidence.
// Places with none came off the site the same day, so this is every place a
// visitor can find.
//
// Kept an hour, like the area pages. A failure is thrown, not kept, and the
// pages then leave the line out rather than show a wrong number.

export interface SiteCounts {
  listed: number;
}

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

const fetchCounts = unstable_cache(
  async (): Promise<SiteCounts> => {
    const { count, error } = await publicClient()
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('is_listed', true);
    if (error || count == null) throw new Error(error?.message ?? 'no count');
    return { listed: count };
  },
  ['site-counts-v2'],
  { revalidate: 3600 }
);

export async function getSiteCounts(): Promise<SiteCounts | null> {
  try {
    return await fetchCounts();
  } catch {
    return null;
  }
}

/** 2150 as "2,150". */
export const formatCount = (n: number) => n.toLocaleString('en-GB');
