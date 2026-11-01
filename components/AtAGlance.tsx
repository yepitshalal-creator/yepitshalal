import clsx from 'clsx';
import { CheckIcon, WarningIcon, InfoIcon } from './icons';
import { glanceTiles, type GlanceTone } from '@/lib/halalGlance';
import type { HalalEvidence, HalalFactsPublic, HalalStatus } from '@/lib/types';

// Halal, alcohol and certificate in three tiles, read in a second
// (lib/halalGlance.ts says where each answer comes from). A glyph beside each
// colour, as in HalalFactsPanel, so colour is never the only signal.

const TONE: Record<GlanceTone, { ink: string; Icon: typeof CheckIcon }> = {
  good: { ink: 'text-halal-fullInk', Icon: CheckIcon },
  warn: { ink: 'text-halal-partialInk', Icon: WarningIcon },
  neutral: { ink: 'text-ink/75', Icon: InfoIcon },
};

export function AtAGlance({
  status,
  facts,
  evidence,
}: {
  status: HalalStatus;
  /** Only facts from our own check; anything else passes null. */
  facts: HalalFactsPublic | null;
  evidence: HalalEvidence[];
}) {
  const tiles = glanceTiles(status, facts, evidence);
  return (
    <section aria-label="At a glance" className="mt-3">
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map((t) => {
          const { ink, Icon } = TONE[t.tone];
          return (
            <div key={t.label} className="min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 shadow-sm">
              {/* The glyph sits by the label, so the answer has the tile's
                  whole width and never breaks inside a word on a phone. */}
              <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">
                <Icon className={clsx('h-3.5 w-3.5 shrink-0', ink)} aria-hidden="true" />
                {t.label}
              </dt>
              <dd className={clsx('mt-1 text-[13.5px] font-semibold leading-tight sm:text-[15px]', ink)}>{t.value}</dd>
              <dd className="mt-0.5 break-words text-[12px] leading-snug text-muted">{t.source}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-1.5 px-1 text-xs text-muted">&ldquo;Not known&rdquo; never means no.</p>
    </section>
  );
}
