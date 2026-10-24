import { requireAdmin } from '@/lib/require-admin';
import Link from 'next/link';
import clsx from 'clsx';
import { AdminPage } from '@/components/admin/ui';
import { BarList, Card, CardLink, EmptyNote, SetupCard, StatTile } from '@/components/admin/dashboard';
import { LineChart } from '@/components/admin/charts/LineChart';
import { SERIES } from '@/components/admin/charts/theme';
import { PlayIcon } from '@/components/icons';
import {
  RANGES,
  customEvents,
  devices,
  errorPages,
  posthogConfigured,
  posthogProjectUrl,
  toRange,
  topPages,
  topSources,
  totals,
  trafficByDay,
  webVitals,
  type Vitals,
  recordingAnswers,
  stillRightAnswers,
} from '@/lib/admin/posthog';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics' };

// The site's own events, in words. An event not listed here shows its name.
const EVENT_LABELS: Record<string, string> = {
  recording_choice: 'Answered the recording question',
  deal_claimed: 'Got a deal code',
  deal_redeemed: 'Had a deal confirmed by staff',
  location_search_submitted: 'Searched for a place',
  current_location_search_requested: 'Searched near where they are',
  restaurant_share_initiated: 'Shared a restaurant',
  feedback_submitted: 'Sent feedback',
  subscription_created: 'Asked us to come to their area',
  language_request_created: 'Asked for their language',
  restaurant_submission_created: 'Sent in a restaurant',
  verification_request_created: 'Asked for a restaurant to be checked',
  sign_in_link_requested: 'Asked for a sign-in link',
  founders_page_viewed: 'Opened the Founders page',
  founders_availability_viewed: 'Saw how many Founder spots are left',
  founders_cta_clicked: 'Tapped to claim a Founder spot',
  founders_standard_cta_clicked: 'Tapped for a free listing',
  founders_instagram_clicked: 'Tapped Instagram on the Founders page',
  founders_form_started: 'Started the Founders form',
  founders_form_submitted: 'Sent the Founders form',
  founders_form_error: 'Hit an error on the Founders form',
  founders_application_result: 'Was told their Founders result',
  founders_application_accepted: 'Founders sign-up saved',
  founders_capacity_reached: 'Took the last Founder spot',
  place_still_right: 'Answered "Is this still right?"',
  place_saved: 'Saved a place',
  place_unsaved: 'Took a place off their saved list',
  browse_fully_halal_near_me: 'Tapped Fully Halal near me',
  app_installed: 'Added the site to their home screen',
};

const SOURCE_NAMES: [RegExp, string][] = [
  [/^\$direct$/, 'Typed in, or a bookmark'],
  [/(^|\.)google\./, 'Google'],
  [/instagram\.com$/, 'Instagram'],
  [/(^|\.)(facebook|fb)\.com$/, 'Facebook'],
  [/tiktok\.com$/, 'TikTok'],
  [/^t\.co$|(^|\.)(x|twitter)\.com$/, 'X (Twitter)'],
  [/bing\.com$/, 'Bing'],
  [/duckduckgo\.com$/, 'DuckDuckGo'],
  [/chatgpt\.com$|openai\.com$/, 'ChatGPT'],
  [/whatsapp/, 'WhatsApp'],
  [/linktr\.ee$/, 'Linktree'],
];

function sourceName(domain: string) {
  return SOURCE_NAMES.find(([re]) => re.test(domain))?.[1] ?? domain.replace(/^www\./, '');
}

const DEVICE_NAMES: Record<string, string> = { Mobile: 'Phones', Desktop: 'Computers', Tablet: 'Tablets' };

// Google's own lines for "good" and "poor", at the 75th percentile.
const VITALS: {
  key: keyof Omit<Vitals, 'samples'>;
  name: string;
  plain: string;
  good: number;
  poor: number;
  unit: 'ms' | '';
}[] = [
  { key: 'lcp', name: 'Main picture shows (LCP)', plain: 'When the biggest thing on screen has loaded', good: 2500, poor: 4000, unit: 'ms' },
  { key: 'fcp', name: 'First paint (FCP)', plain: 'When anything at all appears', good: 1800, poor: 3000, unit: 'ms' },
  { key: 'inp', name: 'Reacts to a tap (INP)', plain: 'How long a tap takes to do something', good: 200, poor: 500, unit: 'ms' },
  { key: 'cls', name: 'Page jumps (CLS)', plain: 'How much things move while loading', good: 0.1, poor: 0.25, unit: '' },
];

function vitalValue(v: number, unit: 'ms' | '') {
  if (unit === '') return v.toFixed(2);
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: { range?: string } }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const range = toRange(searchParams.range);

  if (!posthogConfigured) {
    return (
      <AdminPage tabs={<SectionTabs section="analytics" current="/admin/analytics" />} title="Analytics" width="xl" description="Who visits, what they look at, and how fast it loads.">
        <ConnectPostHog />
      </AdminPage>
    );
  }

  const [traffic, sum, pages, sources, devicesList, events, vitals, errors, answers, stillRight] = await Promise.all([
    trafficByDay(range),
    totals(range),
    topPages(range, 10),
    topSources(range, 8),
    devices(range),
    customEvents(range),
    webVitals(range),
    errorPages(range, 6),
    recordingAnswers(range),
    stillRightAnswers(range),
  ]);

  const versus = `on the ${range} days before`;
  const deviceTotal = (devicesList ?? []).reduce((a, d) => a + d.value, 0);

  return (
    <AdminPage
      tabs={<SectionTabs section="analytics" current="/admin/analytics" />}
      title="Analytics"
      width="xl"
      description="Who visits, what they look at, and how fast it loads. From PostHog, refreshed every 5 minutes."
      action={
        <nav aria-label="Time range" className="inline-flex rounded-full border border-line bg-white p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?range=${r}`}
              aria-current={r === range ? 'page' : undefined}
              className={clsx(
                'inline-flex min-h-[36px] items-center rounded-full px-3.5 text-sm font-semibold transition-colors',
                r === range ? 'bg-ink text-white' : 'text-ink/70 hover:text-ink'
              )}
            >
              {r} days
            </Link>
          ))}
        </nav>
      }
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Visitors" value={sum?.visitors ?? null} previous={sum?.previous.visitors} versus={versus} hint="PostHog did not answer" />
        <StatTile label="Pages viewed" value={sum?.pageviews ?? null} previous={sum?.previous.pageviews} versus={versus} hint="PostHog did not answer" />
        <StatTile label="Searches" value={sum?.searches ?? null} previous={sum?.previous.searches} versus={versus} hint="PostHog did not answer" />
        <StatTile label="Errors in the browser" value={sum?.errors ?? null} previous={sum?.previous.errors} versus={versus} upIsGood={false} hint="PostHog did not answer" />
      </div>

      <Card
        title="Visitors each day"
        note={`The last ${range} days. With no cookies, a visitor is counted fresh each day.`}
        className="mt-4"
        action={<CardLink href={`${posthogProjectUrl}/web`} external>Open PostHog</CardLink>}
      >
        {traffic ? (
          <LineChart
            days={traffic.map((d) => d.day)}
            series={[
              { name: 'Visitors', color: SERIES.one, values: traffic.map((d) => d.visitors) },
              { name: 'Pages viewed', color: SERIES.two, values: traffic.map((d) => d.pageviews) },
            ]}
            height={280}
            label={`Visitors and pages viewed each day, last ${range} days`}
          />
        ) : (
          <EmptyNote>PostHog did not answer just now. It tries again in a few minutes.</EmptyNote>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Most viewed pages" className="lg:col-span-2">
          <BarList
            rows={(pages ?? []).map((p) => ({ key: p.label, label: p.label, value: p.value }))}
            empty="No page views in this time."
            valueLabel="Views"
          />
        </Card>
        <Card title="Where they came from" note="Visitors arriving from each place">
          <BarList
            rows={(sources ?? []).map((s) => ({ key: s.label, label: sourceName(s.label), value: s.value }))}
            empty="Nobody arrived from anywhere in this time."
            color={SERIES.three}
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="What people did" note="The site's own events" className="lg:col-span-2">
          <BarList
            rows={(events ?? []).map((e) => ({ key: e.label, label: EVENT_LABELS[e.label] ?? e.label, value: e.value }))}
            empty="No searches, shares or form sends in this time."
            color={SERIES.two}
            valueLabel="Times"
          />
        </Card>
        <Card title="Phone or computer" note="Share of visitors">
          {deviceTotal > 0 ? (
            <BarList
              rows={(devicesList ?? []).map((d) => ({ key: d.label, label: DEVICE_NAMES[d.label] ?? d.label, value: Math.round((d.value / deviceTotal) * 100) }))}
              empty=""
              format={(n) => `${n}%`}
            />
          ) : (
            <EmptyNote>No visitors in this time.</EmptyNote>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Page speed"
          note={vitals?.samples ? `For 3 in 4 visits it was this fast or faster. ${vitals.samples.toLocaleString('en-GB')} readings.` : 'Timed on real visits'}
          className="lg:col-span-2"
        >
          {vitals && vitals.samples > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {VITALS.map((v) => {
                const value = vitals[v.key];
                const status = value === null ? null : value <= v.good ? 'good' : value > v.poor ? 'poor' : 'ok';
                return (
                  <li key={v.key} className="rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{v.name}</p>
                      {status && (
                        <span
                          className={clsx(
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            status === 'good' && 'bg-halal-fullSoft text-halal-fullInk',
                            status === 'ok' && 'bg-halal-partialSoft text-halal-partialInk',
                            status === 'poor' && 'bg-[#FBE7E2] text-[#9A2E16]'
                          )}
                        >
                          {status === 'good' ? '✓ Good' : status === 'ok' ? '! Could be faster' : '✕ Slow'}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-ink">{value === null ? <span className="text-base font-medium text-subtle">No reading</span> : vitalValue(value, v.unit)}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {v.plain}. Good is under {vitalValue(v.good, v.unit)}.
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyNote>No page timings in this time.</EmptyNote>
          )}
        </Card>

        <div className="space-y-4">
          <Card
            title="Where things broke"
            note="Errors caught in visitors' browsers"
            action={<CardLink href={`${posthogProjectUrl}/error_tracking`} external>Details</CardLink>}
          >
            <BarList
              rows={(errors ?? []).map((e) => ({ key: e.label, label: e.label, value: e.value }))}
              empty="No errors in this time."
              color="#C2410C"
            />
          </Card>

          <Card title="Replays" note="Watching a visit back">
            <p className="text-sm leading-relaxed text-muted">
              Only visits where someone said yes to the recording question. Admin pages and anything private show as
              an empty box. PostHog keeps each one for 30 days.
            </p>
            {answers ? (
              <p className="mt-3 text-sm text-ink">
                <span className="font-semibold tabular-nums">{answers.yes}</span> said yes,{' '}
                <span className="font-semibold tabular-nums">{answers.no}</span> said no, in the last {range} days.
              </p>
            ) : null}
            <a
              href={`${posthogProjectUrl}/replay/home`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-ink hover:border-ink/30"
            >
              <PlayIcon className="h-4 w-4" /> Replays in PostHog
            </a>
          </Card>

          {/* One of the 2026-10-12 plan's numbers to watch: how fresh people
              find the listings. */}
          <Card title="Is this still right?" note="Answers under a place's halal label">
            {stillRight ? (
              <p className="text-sm text-ink">
                <span className="font-semibold tabular-nums">{stillRight.yes}</span> said yes,{' '}
                <span className="font-semibold tabular-nums">{stillRight.changed}</span> said something changed,{' '}
                <span className="font-semibold tabular-nums">{stillRight.closed}</span> said it has closed, in the last{' '}
                {range} days.
              </p>
            ) : (
              <EmptyNote>PostHog did not answer just now. It tries again in a few minutes.</EmptyNote>
            )}
            <p className="mt-2 text-xs leading-relaxed text-subtle">
              The last two open the edit form. Any that are sent arrive in the inbox.
            </p>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}

function ConnectPostHog() {
  return (
    <div id="connect" className="max-w-2xl">
      <SetupCard
        title="Connect PostHog to see your visitors here"
        body="PostHog already counts visits to yepitshalal.com. This page needs one key that can only read, never change anything."
        steps={[
          <>
            Open{' '}
            <a href="https://eu.posthog.com/settings/user-api-keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline">
              PostHog, Personal API keys
            </a>
            . Sign in with Google.
          </>,
          <>Press “Create personal API key”. Name it “yepitshalal admin”.</>,
          <>Under scopes, pick Query, and set it to Read. Nothing else. Then create it and copy the key.</>,
          <>In Vercel, open the yepitshalal project, then Settings, then Environment Variables.</>,
          <>Add POSTHOG_PERSONAL_API_KEY with the key, for Production only. Then redeploy.</>,
        ]}
        footer="The key stays on the server. It is never sent to a browser."
      />
    </div>
  );
}
