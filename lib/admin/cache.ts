import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

// Admin reads are cached for a short while so moving around the admin does not
// ask the database the same questions on every click. Shabir, 2026-10-10:
// cache where possible to keep the site's usage down.
//
// Every entry carries the ADMIN_DATA tag, and every admin action that changes
// something calls revalidateTag(ADMIN_DATA), so your own change shows at once.
// What other people change (a new message from a form, a diner using a deal)
// shows within the entry's few minutes.

export const ADMIN_DATA = 'admin-data';

/** Cache an admin read for `seconds`, keyed by `key` plus its arguments. */
export function adminCached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, seconds: number) {
  return unstable_cache(fn, ['admin', key], { revalidate: seconds, tags: [ADMIN_DATA] });
}

/**
 * revalidatePath, plus the admin's cached reads. The admin actions call this
 * in place of revalidatePath, so whatever they change shows at once.
 */
export function revalidateAdminPath(path: string, type?: 'layout' | 'page') {
  revalidateTag(ADMIN_DATA);
  revalidatePath(path, type);
}
