import Link from 'next/link';
import clsx from 'clsx';
import { waitingCounts } from '@/lib/admin/stats';
import { SECTIONS, onTab, type SectionId } from '@/lib/admin/sections';

// The tabs along the top of a section's pages (lib/admin/sections.ts). Each
// page says which tab it is, so this needs no browser code. The numbers come
// from the same 30 second count as the sidebar's.
export async function SectionTabs({ section, current }: { section: SectionId; current: string }) {
  const counts = await waitingCounts().catch(() => null);
  return (
    <nav aria-label={SECTIONS[section].label} className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none]">
      {SECTIONS[section].tabs.map((tab) => {
        const active = onTab(current, tab.href);
        const n = tab.count && tab.count !== 'setup' && counts ? counts[tab.count] : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              '-mb-px inline-flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors',
              active ? 'border-accent-ink text-ink' : 'border-transparent text-muted hover:text-ink'
            )}
          >
            {tab.label}
            {n > 0 && (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-forest-deep px-1.5 text-[11px] leading-5 text-accent-onDark tabular-nums">
                {n > 99 ? '99+' : n}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
