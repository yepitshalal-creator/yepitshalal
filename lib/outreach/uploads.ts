'use server';

import { notifyInbox } from '@/lib/notify';
import { SITE_URL } from '@/lib/site';
import { OWNER_BUCKET, activePermission, contactByToken, outreachDb, targetOf } from './data';

// Photos and videos an owner adds on the /yes page, after saying yes (0054,
// owner_uploads). Files go straight from their browser into the private
// owner-uploads bucket through signed links; nothing reaches the site until
// it is published from /admin/outreach.

const MB = 1024 * 1024;
const LIMITS = {
  photo: { max: 12, bytes: 15 * MB },
  video: { max: 4, bytes: 50 * MB },
};
// The free plan has 1 GB for every picture on the site. Owner uploads stop
// well short of it, and a video past this points them to email instead.
const ALL_OWNER_UPLOADS_BYTES = 600 * MB;

const PHOTO_TYPES = ['image/webp', 'image/jpeg'];
const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

export type UploadPart = 'full' | 'card' | 'thumb' | 'video';

export interface StartResult {
  error?: string;
  id?: string;
  targets?: { part: UploadPart; path: string; token: string; contentType: string }[];
}

export async function startUpload(
  token: string,
  kind: 'photo' | 'video',
  parts: { part: UploadPart; contentType: string; bytes: number }[]
): Promise<StartResult> {
  const db = outreachDb();
  const contact = await contactByToken(db, token);
  if (!contact) return { error: 'This link does not work any more.' };
  const permission = await activePermission(db, contact.id);
  if (!permission) return { error: 'Say yes first, then add your photos.' };

  const want: UploadPart[] = kind === 'photo' ? ['full', 'card', 'thumb'] : ['video'];
  if (parts.length !== want.length || !want.every((w) => parts.some((p) => p.part === w))) return { error: 'Something went wrong. Try again.' };
  for (const p of parts) {
    const ok = kind === 'photo' ? PHOTO_TYPES.includes(p.contentType) : p.contentType in VIDEO_TYPES;
    if (!ok) return { error: kind === 'photo' ? 'That photo type does not work. Try a JPG.' : 'Videos need to be MP4, MOV or WebM.' };
    if (!(p.bytes > 0)) return { error: 'That file is empty.' };
  }
  const bytes = parts.reduce((n, p) => n + p.bytes, 0);
  if (bytes > LIMITS[kind].bytes) {
    return { error: kind === 'photo' ? 'That photo is too big.' : 'That video is over 50 MB. Reply to our email with it instead.' };
  }

  const { data: mine } = await db
    .from('owner_uploads')
    .select('kind')
    .eq('permission_id', permission.id)
    .not('status', 'in', '(rejected,removed)');
  if ((mine ?? []).filter((u) => u.kind === kind).length >= LIMITS[kind].max) {
    return { error: `That is the most ${kind}s we can take here. Reply to our email with any more.` };
  }
  // Every page: the API answers at most 1,000 rows a request, and a short
  // sum here would let uploads past the free storage limit.
  let used = 0;
  for (let from = 0; ; from += 1000) {
    const { data: sizes, error: sizeError } = await db
      .from('owner_uploads')
      .select('bytes')
      .not('status', 'in', '(rejected,removed)')
      .order('id')
      .range(from, from + 999);
    if (sizeError) return { error: 'Something went wrong. Try again in a minute.' };
    used += (sizes ?? []).reduce((n, r) => n + Number(r.bytes), 0);
    if ((sizes ?? []).length < 1000) break;
  }
  if (used + bytes > ALL_OWNER_UPLOADS_BYTES) return { error: 'We cannot take files here right now. Reply to our email with them instead.' };

  const id = crypto.randomUUID();
  const ext = (t: string) => (t === 'image/webp' ? 'webp' : t === 'image/jpeg' ? 'jpg' : VIDEO_TYPES[t]);
  const paths = Object.fromEntries(parts.map((p) => [p.part, `${permission.id}/${id}/${p.part}.${ext(p.contentType)}`]));
  const { error } = await db.from('owner_uploads').insert({
    id,
    permission_id: permission.id,
    restaurant_id: contact.restaurant_id,
    brand_id: contact.brand_id,
    kind,
    paths,
    bytes,
  });
  if (error) return { error: 'Something went wrong. Try again in a minute.' };

  const targets: NonNullable<StartResult['targets']> = [];
  for (const p of parts) {
    const { data, error: signError } = await db.storage.from(OWNER_BUCKET).createSignedUploadUrl(paths[p.part]);
    if (signError || !data) return { error: 'Something went wrong. Try again in a minute.' };
    targets.push({ part: p.part, path: data.path, token: data.token, contentType: p.contentType });
  }
  return { id, targets };
}

/** After the browser has sent every part: checks the files are there, then queues it for a look. */
export async function finishUpload(token: string, id: string): Promise<{ ok: boolean }> {
  const db = outreachDb();
  const contact = await contactByToken(db, token);
  if (!contact) return { ok: false };
  const permission = await activePermission(db, contact.id);
  if (!permission) return { ok: false };
  const { data: upload } = await db
    .from('owner_uploads')
    .select('id, paths, status')
    .eq('id', id)
    .eq('permission_id', permission.id)
    .maybeSingle();
  if (!upload || upload.status !== 'uploading') return { ok: false };

  const names = Object.values(upload.paths as Record<string, string>).map((p) => p.split('/').pop());
  const { data: files } = await db.storage.from(OWNER_BUCKET).list(`${permission.id}/${id}`);
  const present = new Set((files ?? []).map((f) => f.name));
  if (!names.every((n) => n && present.has(n))) return { ok: false };

  await db.from('owner_uploads').update({ status: 'waiting' }).eq('id', id).eq('status', 'uploading');
  return { ok: true };
}

/** Once per batch, so a dozen photos make one email, not twelve. */
export async function uploadsSent(token: string, count: number): Promise<void> {
  if (!(count > 0)) return;
  const db = outreachDb();
  const contact = await contactByToken(db, token);
  if (!contact) return;
  // Only after real files arrived, so this cannot be used to send us email.
  const permission = await activePermission(db, contact.id);
  if (!permission) return;
  const { count: recent } = await db
    .from('owner_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('permission_id', permission.id)
    .eq('status', 'waiting')
    .gte('created_at', new Date(Date.now() - 15 * 60000).toISOString());
  if (!recent) return;
  const target = await targetOf(db, contact);
  await notifyInbox({
    inbox: 'info',
    subject: `New photos or videos to look at: ${target?.name ?? 'a place'}`,
    fields: [
      ['Place', target?.name],
      ['Files', String(Math.min(count, recent))],
    ],
    action: { label: 'Look at them', href: `${SITE_URL}/admin/outreach` },
  });
}
