import Link from 'next/link';
import Image from 'next/image';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { approveReel, rejectReel } from '@/lib/reel-actions';
import { AdminPage, Panel, List, Row, Tag, FIELD } from '@/components/admin/ui';
import { ArrowUpRightIcon, SparkleIcon } from '@/components/icons';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reels' };

interface PendingReel {
  id: string;
  restaurant_id: string;
  media_kind: 'upload' | 'embed';
  media_url: string;
  provider: string | null;
  cover_url: string | null;
  caption: string | null;
  created_at: string;
  restaurants: { name: string; slug: string } | null;
}

export default async function AdminReelsPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const supabase = createAdminSupabase();

  const [{ data: pending }, { data: published }] = await Promise.all([
    supabase
      .from('restaurant_reels')
      .select('id, restaurant_id, media_kind, media_url, provider, cover_url, caption, created_at, restaurants(name, slug)')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true }),
    supabase
      .from('restaurant_reels')
      .select('id, caption, published_at, restaurants(name, slug)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20),
  ]);

  const queue = (pending ?? []) as unknown as PendingReel[];

  return (
    <AdminPage
      tabs={<SectionTabs section="partners" current="/admin/reels" />}
      title="Reels"
      width="lg"
      description={
        <>
          Every reel is reviewed before it goes live. A paying partner gets more slots, never a
          faster or softer review, and never a bearing on halal classification.
        </>
      }
    >
      <div className="space-y-5">
        <Panel title="Waiting for review" action={<Tag tone={queue.length ? 'ink' : 'neutral'}>{queue.length}</Tag>}>
          <List empty="Nothing waiting. ">
            {queue.map((reel) => (
              <Row key={reel.id} className="items-start">
                <div className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-xl bg-halal-unverifiedSoft">
                  {reel.cover_url ? (
                    <Image src={reel.cover_url} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <video
                      src={reel.media_url}
                      className="h-full w-full object-cover"
                      muted
                      controls
                      preload="metadata"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/restaurant/${reel.restaurants?.slug ?? ''}`}
                    className="inline-flex items-center gap-1 font-medium text-ink hover:underline"
                  >
                    {reel.restaurants?.name ?? 'Unknown restaurant'}
                    <ArrowUpRightIcon className="h-3.5 w-3.5 text-subtle" />
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {reel.media_kind === 'upload' ? 'Uploaded video' : `${reel.provider} embed`} ·
                    submitted {new Date(reel.created_at).toLocaleDateString('en-GB')}
                  </p>
                  {reel.caption && (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{reel.caption}</p>
                  )}
                  {reel.media_kind === 'embed' && (
                    <a
                      href={reel.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
                    >
                      Open the original
                      <ArrowUpRightIcon className="h-3 w-3" />
                    </a>
                  )}

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <form action={approveReel.bind(null, reel.id)}>
                      <button className="inline-flex min-h-[36px] items-center rounded-full bg-ink px-4 text-xs font-semibold text-white transition hover:bg-accent-ink">
                        Approve
                      </button>
                    </form>
                    <form action={rejectReel.bind(null, reel.id)} className="flex items-end gap-2">
                      <div>
                        <label
                          htmlFor={`note-${reel.id}`}
                          className="mb-1 block text-[11px] font-medium text-subtle"
                        >
                          Reason (shown to the restaurant)
                        </label>
                        <input
                          id={`note-${reel.id}`}
                          name="moderation_note"
                          className={`${FIELD} min-w-[16rem] py-2`}
                        />
                      </div>
                      <button className="inline-flex min-h-[36px] items-center rounded-full border border-line px-4 text-xs font-semibold text-halal-partialInk transition hover:border-halal-partial/40">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </Row>
            ))}
          </List>
        </Panel>

        <Panel title="Recently published" action={<Tag>{(published ?? []).length}</Tag>}>
          <List empty="Nothing published yet.">
            {(published ?? []).map((reel) => {
              const r = reel.restaurants as unknown as { name: string; slug: string } | null;
              return (
                <Row key={reel.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r?.name ?? 'Unknown'}</p>
                    <p className="truncate text-xs text-muted">{reel.caption || 'No caption'}</p>
                  </div>
                  <span className="shrink-0 text-xs text-subtle">
                    {reel.published_at
                      ? new Date(reel.published_at).toLocaleDateString('en-GB')
                      : 'None'}
                  </span>
                </Row>
              );
            })}
          </List>
        </Panel>

        <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
          <SparkleIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
          Partner status and per-restaurant reel allowance are set on the restaurant&apos;s own admin
          page.
        </p>
      </div>
    </AdminPage>
  );
}
