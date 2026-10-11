import Link from 'next/link';
import clsx from 'clsx';
import { compact } from '@/lib/admin/format';
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon } from '@/components/icons';
import { SERIES } from './charts/theme';

// The dashboard's building blocks. Server components: everything here renders
// without JavaScript, and only the two charts hydrate.

/** A titled white card. The title says what it is; the note says over what time. */
export function Card({
  title,
  note,
  action,
  children,
  className,
  id,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={clsx('min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-semibold leading-snug text-ink">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-subtle">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CardLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const Icon = external ? ArrowUpRightIcon : ArrowRightIcon;
  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-accent-ink hover:bg-accent-soft"
    >
      {children}
      <Icon className="h-3.5 w-3.5" />
    </Link>
  );
}

/** Twelve-ish points in the de-emphasis colour, the last one marked. */
export function Sparkline({ values, color = SERIES.one }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - (v / max) * (h - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="#B7C6C9" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

/**
 * How a number moved, in words. A percent only once the earlier number is big
 * enough to mean something: one message becoming seven is "6 more", not "up
 * 600%", which reads like an alarm over almost nothing.
 */
function describeChange(value: number, previous: number): { dir: -1 | 0 | 1; text: string } {
  const diff = value - previous;
  const dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
  if (dir === 0) return { dir, text: 'Same' };
  if (previous >= 20) {
    const pct = Math.round((Math.abs(diff) / previous) * 100);
    if (pct === 0) return { dir: 0, text: 'About the same' };
    return { dir, text: `${dir > 0 ? 'Up' : 'Down'} ${pct}%` };
  }
  return { dir, text: `${Math.abs(diff).toLocaleString('en-GB')} ${dir > 0 ? 'more' : 'fewer'}` };
}

/**
 * One number and how it moved. Up is not always good: more errors is worse,
 * so the tile is told which way is better and colours the change by that,
 * with an arrow and words so it never rests on colour alone.
 */
export function StatTile({
  label,
  value,
  previous,
  versus,
  trend,
  upIsGood = true,
  hint,
}: {
  label: string;
  value: number | null;
  /** The same number for the period before, to say how it moved. */
  previous?: number | null;
  versus?: string;
  trend?: number[];
  upIsGood?: boolean;
  hint?: string;
}) {
  const moved = value !== null && previous !== null && previous !== undefined ? describeChange(value, previous) : null;
  const good = moved && moved.dir !== 0 ? (moved.dir > 0) === upIsGood : null;
  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {trend && (
          <span className="hidden sm:block">
            <Sparkline values={trend} />
          </span>
        )}
      </div>
      <div>
        <p className="text-[28px] font-semibold leading-none tracking-tight text-ink">
          {value === null ? <span className="text-base font-medium text-subtle">No data</span> : compact(value)}
        </p>
        <p className="mt-2 min-h-[18px] text-xs text-subtle">
          {value === null ? (
            hint
          ) : moved ? (
            <>
              <span
                className={clsx(
                  'mr-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-semibold',
                  good === null && 'bg-black/[0.05] text-ink/70',
                  good === true && 'bg-halal-fullSoft text-halal-fullInk',
                  good === false && 'bg-[#FBE7E2] text-[#9A2E16]'
                )}
              >
                <span aria-hidden>{moved.dir > 0 ? '▲' : moved.dir < 0 ? '▼' : '●'}</span>
                {moved.text}
              </span>
              {versus}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/** A ranked list, label on the left, number on the right, a thin bar under each. */
export function BarList({
  rows,
  color = SERIES.one,
  empty,
  valueLabel,
  format = (n) => n.toLocaleString('en-GB'),
}: {
  rows: { label: React.ReactNode; value: number; key?: string; href?: string }[];
  color?: string;
  empty: string;
  valueLabel?: string;
  format?: (n: number) => string;
}) {
  if (rows.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {valueLabel && (
        <p className="mb-1.5 flex justify-end text-[11px] font-semibold uppercase tracking-wide text-subtle">{valueLabel}</p>
      )}
      <ol className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.key ?? i}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink/90">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{format(r.value)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-soft">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-sand-line bg-sand-soft/60 px-4 py-6 text-center text-sm leading-relaxed text-muted">
      {children}
    </p>
  );
}

/** Something waiting on a person, as a big tappable card. Calm when there is nothing. */
export function ActionCard({
  href,
  count,
  label,
  clear,
  Icon,
  urgent,
}: {
  href: string;
  count: number;
  label: string;
  /** What to say when the count is zero. */
  clear: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** A short warning in amber, such as "2 late". */
  urgent?: string | null;
}) {
  const busy = count > 0;
  return (
    <Link
      href={href}
      className={clsx(
        'group flex min-h-[112px] flex-col justify-between gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md',
        busy ? 'border-forest-deep bg-forest-deep text-white shadow-sm' : 'border-line bg-white text-ink shadow-sm'
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className={clsx(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            busy ? 'bg-accent text-forest-deep' : 'bg-halal-fullSoft text-halal-fullInk'
          )}
        >
          {busy ? <Icon className="h-[18px] w-[18px]" /> : <CheckIcon className="h-[18px] w-[18px]" />}
        </span>
        <ArrowRightIcon
          className={clsx(
            'mt-1 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5',
            busy ? 'text-accent-onDark' : 'text-subtle'
          )}
        />
      </span>
      <span className="min-w-0">
        <span className={clsx('block text-2xl font-semibold leading-none', !busy && 'text-ink/40')}>{count}</span>
        <span className={clsx('mt-1.5 block text-sm leading-snug', busy ? 'text-white/85' : 'text-muted')}>
          {busy ? label : clear}
        </span>
        {busy && urgent && (
          <span className="mt-2 inline-flex rounded-full bg-halal-partialSoft px-2 py-0.5 text-xs font-semibold text-halal-partialInk">{urgent}</span>
        )}
      </span>
    </Link>
  );
}

/** A filled bar out of a total, for the Founders cap. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink/90">{label}</span>
        <span className="font-semibold tabular-nums text-ink">
          {value} <span className="font-normal text-subtle">of {max}</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-spice-soft"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-spice" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Shown where a chart would be when a service is not connected yet. */
export function SetupCard({
  title,
  body,
  steps,
  footer,
}: {
  title: string;
  body: string;
  steps?: React.ReactNode[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-spice/40 bg-spice-soft/50 p-5">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      {steps && (
        <ol className="mt-3 space-y-1.5 text-sm text-ink/85">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-spice text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {footer && <div className="mt-3 text-xs text-muted">{footer}</div>}
    </div>
  );
}
