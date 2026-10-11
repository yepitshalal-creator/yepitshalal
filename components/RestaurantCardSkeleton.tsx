// Mirrors the search card's tile layout (RestaurantCard, layout="tile") box for
// box, so swapping the real card in causes no layout shift.
export function RestaurantCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-black/5" aria-hidden="true">
      <div className="aspect-[16/9] w-full bg-black/[0.06]" />
      <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-3 sm:px-4">
        <div className="h-5 w-2/3 rounded bg-black/[0.08]" />
        <div className="h-3 w-3/5 rounded bg-black/[0.05]" />
        <div className="h-3 w-4/5 rounded bg-black/[0.05]" />
        <div className="h-[18px] w-24 rounded-full bg-black/[0.05]" />
      </div>
    </div>
  );
}
