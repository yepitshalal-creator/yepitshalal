import clsx from 'clsx';

// Shared admin primitives. Before this, each admin page carried its own
// `FIELD_CLASS` (three different definitions) and its own hand-rolled card and
// list markup, which is why they had drifted apart on borders, muted tones and
// control heights. Everything here uses the same tokens as the public site.

// 16px on mobile so iOS Safari doesn't zoom the page on focus; 14px from sm up,
// where the admin is dense and mostly used on a laptop.
export const FIELD =
  'w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-[16px] text-ink placeholder:text-subtle transition focus:border-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-ink/20 sm:text-sm';

export const BUTTON =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-accent-ink active:scale-[0.99] disabled:opacity-60';

export const BUTTON_SECONDARY =
  'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink/30 disabled:opacity-60';

export function AdminPage({
  title,
  description,
  action,
  tabs,
  width = 'md',
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** A section's tabs (components/admin/SectionTabs), shown above the title. */
  tabs?: React.ReactNode;
  /** `xl` is the dashboard's width: room for charts and tables side by side.
   *  Widened 2026-10-10 when admin got its own sidebar and the full window. */
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        // Left aligned beside the sidebar, so a title sits in the same place on
        // every page whatever its width.
        'px-4 py-8 sm:px-6 sm:py-10 lg:px-8',
        width === 'sm' && 'max-w-2xl',
        width === 'md' && 'max-w-4xl',
        width === 'lg' && 'max-w-5xl',
        width === 'xl' && 'max-w-7xl'
      )}
    >
      {tabs}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          {description && (
            <div className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{description}</div>
          )}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('rounded-2xl border border-line bg-white shadow-sm', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="font-display text-base font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A divided list inside a Panel. Rows come from `Row`. */
export function List({ children, empty }: { children?: React.ReactNode; empty: string }) {
  const isEmpty = !children || (Array.isArray(children) && children.flat().length === 0);
  if (isEmpty) {
    return <p className="px-5 py-8 text-center text-sm text-muted">{empty}</p>;
  }
  return <ul className="divide-y divide-line">{children}</ul>;
}

/** `padded={false}` when the row's whole area is a link or button that should
 *  own the padding, otherwise the tap target stops short of the row edges. */
export function Row({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <li
      className={clsx(
        'flex items-center justify-between gap-3',
        padded && 'px-5 py-3.5',
        className
      )}
    >
      {children}
    </li>
  );
}

/** Labelled field wrapper. Admin inputs were placeholder-only, which leaves a
 *  field with no accessible name once anything is typed into it. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const TONE_CLASS = {
  neutral: 'bg-black/[0.05] text-ink/75 ring-black/10',
  good: 'bg-halal-fullSoft text-halal-fullInk ring-halal-full/20',
  warn: 'bg-halal-partialSoft text-halal-partialInk ring-halal-partial/20',
  accent: 'bg-accent-soft text-accent-ink ring-accent/20',
  ink: 'bg-ink text-white ring-transparent',
} as const;

export function Tag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
        TONE_CLASS[tone]
      )}
    >
      {children}
    </span>
  );
}

// The database enums were rendered raw ("awaiting_slot", "pending_qc"), which
// reads as a leaked implementation detail even to the person running the queue.
const QUEUE_STATUS: Record<string, { label: string; tone: keyof typeof TONE_CLASS }> = {
  awaiting_slot: { label: 'Awaiting slot', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'accent' },
  pending_qc: { label: 'Pending QC', tone: 'warn' },
  published: { label: 'Published', tone: 'good' },
};

export function QueueStatusTag({ status }: { status: string }) {
  const entry = QUEUE_STATUS[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as const };
  return <Tag tone={entry.tone}>{entry.label}</Tag>;
}

const SUBSCRIPTION_TONE: Record<string, keyof typeof TONE_CLASS> = {
  active: 'good',
  trialing: 'accent',
  past_due: 'warn',
  canceled: 'neutral',
  unpaid: 'warn',
};

export function SubscriptionStatusTag({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <Tag tone={SUBSCRIPTION_TONE[status] ?? 'neutral'}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </Tag>
  );
}
