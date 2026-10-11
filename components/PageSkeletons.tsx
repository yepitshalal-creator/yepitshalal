import clsx from 'clsx';
import { forestFade, forestLights } from './grounds';
import { pageShell, panel } from './prose';
import { RestaurantCardSkeleton } from './RestaurantCardSkeleton';

// What a page looks like while it is on its way. Without these, a tap on a
// link to any page that reads the database did nothing at all until the whole
// page had arrived, which is what made moving around the site feel stuck.
// components/NavPending.tsx shows one the moment the link is tapped.
//
// Each one copies its page's frame (the same widths, paddings and picture
// shapes) so the real page lands where the grey shapes were and nothing jumps.
// Grey shapes only, never words or numbers: a placeholder must not look like
// a fact. Pulsing is opacity only, and the reduced motion rule in globals.css
// stills it.

function Bone({ className, dark = false }: { className?: string; dark?: boolean }) {
  return <span aria-hidden="true" className={clsx('block animate-pulse', dark ? 'bg-white/[0.14]' : 'bg-black/[0.07]', className)} />;
}

/** Read out once, so a screen reader hears that something is coming. */
function Status() {
  return (
    <p role="status" className="sr-only">
      Loading
    </p>
  );
}

/** The forest header of PageHero, with grey bars where its words go. */
function HeroSkeleton({ lede = true }: { lede?: boolean }) {
  return (
    <div className="ground-dark relative overflow-hidden bg-forest-deep">
      <div aria-hidden="true" className={`absolute inset-0 ${forestLights}`} />
      <div aria-hidden="true" className={forestFade} />
      <div className={`${pageShell} relative pb-14 pt-9 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16`}>
        <Bone dark className="mb-6 h-3 w-36 rounded-full" />
        <Bone dark className="h-8 w-[85%] max-w-xl rounded-lg sm:h-10" />
        <Bone dark className="mt-2.5 h-8 w-[55%] max-w-sm rounded-lg sm:h-10" />
        {lede && (
          <>
            <Bone dark className="mt-6 h-3.5 w-full max-w-lg rounded-full" />
            <Bone dark className="mt-2.5 h-3.5 w-[70%] max-w-md rounded-full" />
          </>
        )}
        <Bone dark className="mt-8 h-11 w-48 rounded-full" />
      </div>
    </div>
  );
}

/** One row of a list of places: name, address, label. */
function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <Bone className="h-4 w-[62%] rounded-full" />
        <Bone className="mt-2 h-3 w-[78%] rounded-full" />
        <Bone className="mt-2.5 h-[22px] w-28 rounded-full" />
      </span>
      <Bone className="h-4 w-4 shrink-0 rounded-full" />
    </li>
  );
}

function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className={`mt-4 divide-y divide-line overflow-hidden ${panel}`}>
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </ul>
  );
}

/** A borough or a kind of food: the forest header, then the places grouped by label. */
export function AreaPageSkeleton() {
  return (
    <div>
      <Status />
      <HeroSkeleton />
      <div className={`${pageShell} pb-4 pt-6 sm:pt-8`}>
        <div className="mt-10 max-w-3xl">
          <Bone className="h-6 w-44 rounded-lg" />
          <Bone className="mt-2.5 h-3.5 w-72 max-w-full rounded-full" />
          <RowsSkeleton />
        </div>
      </div>
    </div>
  );
}

/** "Is it halal?" for a place or a chain: the question, the answer, the evidence. */
export function QuestionPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Status />
      <Bone className="h-3 w-44 rounded-full" />
      <Bone className="mt-5 h-9 w-[80%] rounded-lg sm:h-10" />
      <Bone className="mt-3 h-3.5 w-[65%] rounded-full" />
      {/* The short answer is a dark box on the real page, so it is here too. */}
      <div className="mt-5 rounded-2xl bg-forest-deep p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Bone dark className="h-3 w-28 rounded-full" />
          <Bone dark className="h-9 w-32 rounded-full" />
        </div>
        <Bone dark className="mt-4 h-7 w-20 rounded-lg" />
        <Bone dark className="mt-4 h-4 w-full rounded-full" />
        <Bone dark className="mt-2.5 h-4 w-[88%] rounded-full" />
        <Bone dark className="mt-2.5 h-4 w-[60%] rounded-full" />
      </div>
      <Bone className="mt-8 h-6 w-48 rounded-lg" />
      <RowsSkeleton rows={4} />
    </div>
  );
}

/** A restaurant: the picture, the name, the buttons, then the panels under them. */
export function RestaurantPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4 sm:px-6 sm:py-8">
      <Status />
      <Bone className="-mx-4 aspect-[16/9] sm:mx-0 sm:aspect-[21/8] sm:rounded-2xl" />
      <Bone className="mt-5 h-8 w-[70%] rounded-lg sm:h-9" />
      <Bone className="mt-3 h-3.5 w-[80%] max-w-md rounded-full" />
      <div className="mt-3 flex items-center justify-between gap-3">
        <Bone className="h-7 w-28 rounded-full" />
        <Bone className="h-11 w-28 rounded-full" />
      </div>
      <div className={`mt-6 p-5 sm:p-6 ${panel}`}>
        <Bone className="h-5 w-40 rounded-lg" />
        <Bone className="mt-4 h-4 w-full rounded-full" />
        <Bone className="mt-2.5 h-4 w-[82%] rounded-full" />
        <Bone className="mt-2.5 h-4 w-[64%] rounded-full" />
      </div>
      <div className={`mt-4 p-5 sm:p-6 ${panel}`}>
        <Bone className="h-5 w-32 rounded-lg" />
        <Bone className="mt-4 h-4 w-[90%] rounded-full" />
        <Bone className="mt-2.5 h-4 w-[70%] rounded-full" />
      </div>
      {/* Directions, Call and Website sit in a bar above the tab bar on a phone. */}
      <div className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] flex gap-2 border-t border-line bg-white/95 px-4 py-2.5 sm:hidden">
        <Bone className="h-11 flex-[1.2] rounded-full" />
        <Bone className="h-11 flex-1 rounded-full" />
        <Bone className="h-11 flex-1 rounded-full" />
      </div>
    </div>
  );
}

/** Search: the controls panel, then picture cards like the real ones, and the map beside them from 640px. */
export function SearchPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl sm:px-6 sm:py-4">
      <Status />
      <div className="px-4 pb-3 pt-2.5 sm:rounded-[22px] sm:bg-white/60 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <Bone className="h-[46px] min-w-0 flex-1 rounded-full sm:w-72 sm:flex-none" />
          <Bone className="h-[44px] w-[132px] shrink-0 rounded-full sm:hidden" />
        </div>
        <Bone className="mt-2 h-10 w-full rounded-full sm:mt-3 sm:max-w-xs" />
        <div className="mt-2 flex gap-2 sm:hidden">
          <Bone className="h-10 min-w-0 flex-1 rounded-full" />
          <Bone className="h-10 w-24 shrink-0 rounded-full" />
        </div>
      </div>
      <div className="px-4 pt-3 sm:px-0">
        <Bone className="h-3.5 w-44 rounded-full" />
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-4 sm:mt-4 sm:grid-cols-[minmax(0,1fr)_1.1fr]">
        <div aria-hidden="true" className="flex flex-col gap-3 px-4 sm:px-0">
          {Array.from({ length: 3 }, (_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
        <Bone className="hidden sm:sticky sm:top-[4.5rem] sm:block sm:h-[calc(100vh-6rem)] sm:rounded-2xl" />
      </div>
    </div>
  );
}
