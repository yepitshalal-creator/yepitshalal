'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDownIcon, GlobeIcon, XIcon } from './icons';
import { LanguageRequestForm } from './LanguageRequestForm';
import { LOCALES } from '@/lib/locales';

// The language control, where people look for one (2026-09-24).
//
// It used to be a row of languages at the very bottom of the footer, on the
// reasoning that a control most visitors never touch should not take space
// near the search. Shabir: down there it is hard to find, and somebody who
// cannot find their own language leaves. A reader who does not read English
// scans the edges of the screen for a globe and for the shape of their own
// writing, so both are always in view now:
//
//  - from 640px, a globe and the current language in the header, opening a
//    panel under it
//  - on a phone, where the header has no room left, a fifth tab in the bottom
//    bar, opening a sheet from the bottom of the screen
//
// Every language is written in its own script, never in English, and the
// request form sits under the list, where somebody looks the moment they fail
// to find theirs.

type Option = { code: string; endonym: string; href: string; dir: 'ltr' | 'rtl' };

const OPTIONS: Option[] = [
  { code: 'en', endonym: 'English', href: '/', dir: 'ltr' },
  ...LOCALES.map((l) => ({ code: l.code, endonym: l.endonym, href: `/${l.code}`, dir: l.dir })),
];

function currentOption(pathname: string): Option {
  return OPTIONS.find((o) => o.code !== 'en' && (pathname === o.href || pathname.startsWith(`${o.href}/`))) ?? OPTIONS[0];
}

function LanguageList({ current, onPick }: { current: string; onPick?: () => void }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {OPTIONS.map((o) => (
        <li key={o.code}>
          {o.code === current ? (
            <span
              aria-current="page"
              lang={o.code}
              dir={o.dir}
              className="flex min-h-[48px] items-center rounded-xl bg-ink px-3.5 text-[15px] font-semibold text-white"
            >
              {o.endonym}
            </span>
          ) : (
            <Link
              href={o.href}
              hrefLang={o.code}
              lang={o.code}
              dir={o.dir}
              onClick={onPick}
              className="flex min-h-[48px] items-center rounded-xl border border-line bg-white px-3.5 text-[15px] font-medium text-ink transition hover:border-ink/30 hover:bg-sand-soft"
            >
              {o.endonym}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** From 640px: in the header, a disclosure with a panel under it. */
export function LanguageMenu() {
  const pathname = usePathname() ?? '/';
  const current = currentOption(pathname);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative hidden shrink-0 sm:block">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Language: ${current.endonym}`}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
          open ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
        )}
      >
        <GlobeIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        {/* Below 1280px the globe alone, so the header row fits with the
            longest name, "Bahasa Indonesia"; the button's label still names
            the language. */}
        <span className="hidden xl:inline" lang={current.code} dir={current.dir}>
          {current.endonym}
        </span>
        <ChevronDownIcon className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {/* A light surface inside the teal header, so its focus rings take the
          light ground's colour (globals.css, .ground-light). */}
      <div
        id={panelId}
        hidden={!open}
        className="ground-light absolute right-0 top-[calc(100%+10px)] z-50 w-[22rem] rounded-2xl bg-white p-4 text-ink shadow-[0_18px_44px_-18px_rgba(4,24,30,0.55)] ring-1 ring-black/10"
      >
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-subtle">
          <GlobeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Language
        </p>
        <LanguageList current={current.code} onPick={() => setOpen(false)} />
        <LanguageRequestForm locale={current.code} />
      </div>
    </div>
  );
}

/** Below 640px: a tab in the bottom bar, opening a sheet from the bottom. */
export function LanguageTab() {
  const pathname = usePathname() ?? '/';
  const current = currentOption(pathname);
  const sheet = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    sheet.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Language: ${current.endonym}`}
        onClick={() => {
          sheet.current?.showModal();
          setOpen(true);
        }}
        className={clsx(
          'flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors focus-visible:[outline-offset:-4px]',
          open ? 'text-accent-onDark' : 'text-white/75 hover:text-white'
        )}
      >
        <GlobeIcon className="h-[22px] w-[22px]" aria-hidden="true" />
        <span lang={current.code} dir={current.dir} className="block max-w-full truncate">
          {current.endonym}
        </span>
      </button>

      {/* A native modal dialog: it keeps focus inside, closes on Escape, and
          sits above everything, including this bar. A tap on the dimmed page
          around it closes it too. */}
      <dialog
        ref={sheet}
        aria-label="Language"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === sheet.current) sheet.current?.close();
        }}
        className="ground-light m-0 mt-auto max-h-[86vh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white p-0 text-ink backdrop:bg-forest-deep/55"
      >
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-subtle">
              <GlobeIcon className="h-4 w-4" aria-hidden="true" />
              Language
            </p>
            <button
              type="button"
              onClick={() => sheet.current?.close()}
              aria-label="Close"
              className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-black/[0.05] hover:text-ink"
            >
              <XIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2">
            <LanguageList current={current.code} onPick={() => sheet.current?.close()} />
          </div>
          <LanguageRequestForm locale={current.code} />
        </div>
      </dialog>
    </>
  );
}
