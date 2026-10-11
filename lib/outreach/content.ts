import type { SupabaseClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';
import { OWNER_BUCKET } from './data';

// Moving an owner's photo onto their page, and taking everything off again
// when they take their yes back. Server only.

const PUBLIC_BUCKET = 'restaurant-photos';
const PUBLIC_MARKER = `/storage/v1/object/public/${PUBLIC_BUCKET}/`;

export interface OwnerUpload {
  id: string;
  permission_id: string;
  restaurant_id: string | null;
  brand_id: string | null;
  kind: 'photo' | 'video';
  paths: Record<string, string>;
  bytes: number;
  status: string;
  photo_ids: string[];
  created_at: string;
}

/** The place, or every branch of the chain, that a yes covers. */
async function placesOf(db: SupabaseClient, u: Pick<OwnerUpload, 'restaurant_id' | 'brand_id'>) {
  const q = db.from('restaurants').select('id, name, slug, website_url');
  const { data } = await (u.restaurant_id ? q.eq('id', u.restaurant_id) : q.eq('brand_id', u.brand_id as string).eq('is_searchable', true));
  return (data ?? []) as { id: string; name: string; slug: string; website_url: string | null }[];
}

function host(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** True for a picture that is the place's own photo (not stock, not a logo). */
function isOwnPhoto(p: { storage_path: string; is_logo: boolean | null }) {
  return !p.is_logo && !/representative\/|business-logo\/|unsplash/.test(p.storage_path);
}

/**
 * Puts one owner photo on the page of every place it covers. The card and
 * thumbnail sizes were made in the owner's browser; this only copies them
 * into the public bucket, where the site already looks for "thumb/<path>".
 * Credited to the place, as the permission promises.
 *
 * All or nothing: the upload is marked published with the ids of every photo
 * row it made, because that is how taking a yes back finds them. If any page
 * or that record fails, every row it made comes off again, each page gets
 * back the lead photo it had, and it throws.
 */
export async function publishOwnerPhoto(db: SupabaseClient, upload: OwnerUpload): Promise<string[]> {
  if (upload.kind !== 'photo' || !upload.paths.card || !upload.paths.thumb) throw new Error('Only a photo can go on a page.');
  const ext = upload.paths.card.split('.').pop();
  const contentType = ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const owner = upload.restaurant_id ?? upload.brand_id;
  const cardPath = `owner/${owner}/${upload.id}.${ext}`;

  for (const [from, to] of [
    [upload.paths.card, cardPath],
    [upload.paths.thumb, `thumb/${cardPath}`],
  ]) {
    const { data: blob, error } = await db.storage.from(OWNER_BUCKET).download(from);
    if (error || !blob) throw new Error(`Could not read the photo (${error?.message ?? 'missing'}).`);
    const { error: upError } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(to, blob, { contentType, upsert: true, cacheControl: '31536000' });
    if (upError) throw new Error(`Could not store the photo (${upError.message}).`);
  }
  const url = db.storage.from(PUBLIC_BUCKET).getPublicUrl(cardPath).data.publicUrl;

  if (!upload.restaurant_id && !upload.brand_id) throw new Error('That place is no longer on the site.');
  const places = await placesOf(db, upload);
  if (!places.length) throw new Error('That place is no longer on the site.');
  const ids: string[] = [];
  // Lead photos this took the lead from, to give back if it fails.
  const demoted: string[] = [];
  try {
    for (const place of places) {
      const { data: existing, error: readError } = await db
        .from('restaurant_photos')
        .select('id, storage_path, is_logo, is_primary')
        .eq('restaurant_id', place.id);
      if (readError) throw new Error(readError.message);
      // Their own photo leads, unless the page already leads with one of theirs.
      const leadsWithOwn = (existing ?? []).some((p) => p.is_primary && isOwnPhoto(p));
      if (!leadsWithOwn) {
        demoted.push(...(existing ?? []).filter((p) => p.is_primary).map((p) => p.id as string));
        await db.from('restaurant_photos').update({ is_primary: false }).eq('restaurant_id', place.id);
      }
      const site = host(place.website_url);
      const { data: row, error } = await db
        .from('restaurant_photos')
        .insert({
          restaurant_id: place.id,
          storage_path: url,
          type: 'food',
          is_primary: !leadsWithOwn,
          source_site: site ?? place.name,
          source_url: site ? place.website_url : `${SITE_URL}/restaurant/${place.slug}`,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      ids.push(row.id);
    }
    const { error: recordError } = await db
      .from('owner_uploads')
      .update({ status: 'published', photo_ids: ids, reviewed_at: new Date().toISOString() })
      .eq('id', upload.id);
    if (recordError) throw new Error(`Could not record it (${recordError.message}).`);
  } catch (e) {
    // Half on is worse than not on: no page keeps a photo with no record of it.
    if (ids.length) await db.from('restaurant_photos').delete().in('id', ids);
    if (demoted.length) await db.from('restaurant_photos').update({ is_primary: true }).in('id', demoted);
    throw new Error(`${(e as Error).message} It is not on their page. Try again.`);
  }
  return ids;
}

/**
 * Everything an owner sent, off the site and out of storage. Used the moment
 * a yes is taken back: the site part is done at once, our social posts are
 * the only thing left for a person to delete.
 *
 * True only when all of it is gone. An upload that could not be fully
 * removed keeps its status, so running this again carries on from there; it
 * is safe to repeat (/admin/outreach does, before a take-down can be Done).
 */
export async function removeOwnerContent(db: SupabaseClient, permissionId: string): Promise<boolean> {
  const { data, error } = await db.from('owner_uploads').select('*').eq('permission_id', permissionId).neq('status', 'removed');
  if (error) return false;
  let all = true;
  for (const u of (data ?? []) as OwnerUpload[]) {
    if (!(await removeUpload(db, u))) all = false;
  }
  return all;
}

/** One upload off the site and out of storage, in an order a retry can finish. */
async function removeUpload(db: SupabaseClient, u: OwnerUpload): Promise<boolean> {
  if (u.photo_ids.length) {
    // The public files first, while the rows still say where they are.
    const { data: rows, error: readError } = await db
      .from('restaurant_photos')
      .select('id, restaurant_id, storage_path, is_primary')
      .in('id', u.photo_ids);
    if (readError) return false;
    const paths = new Set<string>();
    for (const r of rows ?? []) {
      const path = r.storage_path.split(PUBLIC_MARKER)[1];
      if (path) {
        paths.add(path);
        paths.add(`thumb/${path}`);
      }
    }
    if (paths.size) {
      const { error } = await db.storage.from(PUBLIC_BUCKET).remove([...paths]);
      if (error) return false;
    }
    const { error: deleteError } = await db.from('restaurant_photos').delete().in('id', u.photo_ids);
    if (deleteError) return false;
    // A page whose lead photo went keeps a lead: its earliest other one.
    for (const r of rows ?? []) {
      if (!r.is_primary) continue;
      const { data: next } = await db
        .from('restaurant_photos')
        .select('id')
        .eq('restaurant_id', r.restaurant_id)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (next) await db.from('restaurant_photos').update({ is_primary: true }).eq('id', next.id);
    }
  }
  const { error: privateError } = await db.storage.from(OWNER_BUCKET).remove(Object.values(u.paths));
  if (privateError) return false;
  const { error: markError } = await db
    .from('owner_uploads')
    .update({ status: 'removed', reviewed_at: new Date().toISOString() })
    .eq('id', u.id);
  return !markError;
}
