import Link from 'next/link';
import { LogoLockup } from './Logo';
import { NavLink } from './NavLink';
import { LanguageMenu } from './LanguageMenu';
import { MapIcon, SparkleIcon, StoreIcon } from './icons';
import { AccountNavLink } from './AccountNavLink';

// The header is the logo's own ground since 2026-09-24: its deep teal, with
// the lockup in the logo's white and lime, and the one button in lime.
//
// Solid, and the full width of the window. It was 85 to 95% opaque, which over
// the page's light ground turned the teal a washed-out grey and the logo with
// it; and it sat inside the 1152px content column, so on a wide screen the logo
// floated 200 to 400px in from the corner. Shabir, 2026-09-24: put the logo on
// the top left and make sure it is properly visible.
//
// The same for every visitor, so it reads nothing from the request. The one
// part that differs, "Sign in" or "My account", decides itself in the browser
// (AccountNavLink). Reading the session here made every page dynamic.
// A 44px circle around the icon from 640 to 767px, the usual pill above.
const HEADER_LINK = 'inline-flex items-center justify-center max-md:h-11 max-md:w-11 max-md:px-0';
const OWNERS_BUTTON =
  'mx-0.5 inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-sm font-semibold text-white ring-1 ring-white/45 transition-colors hover:bg-white/10 max-md:h-11 max-md:w-11 md:min-h-[40px] md:px-3';

export function SiteHeader() {
  return (
    <header className="ground-dark header-lift sticky top-0 z-30 border-b border-white/10 bg-forest-deep text-white">
      <div className="flex h-14 w-full items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Nothing in this row shrinks below its own width: the wordmark is a
            picture, and a squeezed link let it run under the Beta chip ("YEP
            ITS HA" with BETA on top, 320 to 385px and 640 to 880px wide, found
            2026-09-26). Instead, where the row is tight, words give way and
            links never do: the wordmark steps down a size, Support us is its
            icon below 375px and from 640 to 767px, the links shorten (below),
            and the language button is its globe until 1280px, which leaves
            room for "Bahasa Indonesia". Measured at each width, signed in and
            out, in English and Indonesian, 2026-10-11. */}
        <span className="inline-flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full"
            aria-label="YepItsHalal home"
          >
            <LogoLockup
              tone="dark"
              wordmarkClassName="h-[15px] w-auto min-[375px]:h-[14px] min-[390px]:h-4 lg:h-[19px]"
            />
          </Link>
          {/* Beside the name on every page, not just the homepage. Somebody who
              arrives on a restaurant page from a search deserves to know how
              young this is before they judge what is missing from it. */}
          <Link
            href="/#next-cities"
            className="relative inline-flex shrink-0 items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-onDark ring-1 ring-accent/40 transition after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:bg-white/15"
            title="London only for now. Tell us where to go next."
          >
            Beta
          </Link>
        </span>

        {/* Below sm these live in the bottom tab bar instead. From 640 to
            767px they are the tab bar's icons, from 768 to 1023px its short
            words, and from 1024px the full names. Every link stays at every
            width, and screen readers hear the full name at each. */}
        <nav aria-label="Primary" className="hidden items-center gap-1 whitespace-nowrap sm:flex">
          <NavLink href="/discover" tone="dark" className={HEADER_LINK}>
            <MapIcon className="h-[18px] w-[18px] md:hidden" aria-hidden="true" />
            <span className="max-md:sr-only">Discover</span>
          </NavLink>
          {/* The way in for restaurant owners: outlined, so it reads as a
              button and not one more link (Shabir, 2026-10-11: "Add" did not
              make it obvious). Its icon alone from 640 to 767px, like the
              links beside it; on a phone it is a tab in the bottom bar. */}
          <Link href="/owners" className={OWNERS_BUTTON}>
            {/* From 768 to 1023px the word and the outline say it alone:
                with "Account" beside it there is no room for more, measured
                2026-10-11. */}
            <StoreIcon className="h-[18px] w-[18px] shrink-0 md:hidden lg:block" aria-hidden="true" />
            <span aria-hidden="true" className="hidden md:inline lg:hidden">
              Owners
            </span>
            <span className="sr-only lg:not-sr-only">For restaurant owners</span>
          </Link>
          <AccountNavLink className={HEADER_LINK} />
        </nav>

        <span className="inline-flex shrink-0 items-center gap-1 sm:gap-2">
          {/* From 640px. On a phone the language lives in the bottom bar. */}
          <LanguageMenu />

          <Link
            href="/yep-plus"
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-forest-deep transition duration-200 hover:-translate-y-px hover:bg-accent-onDark active:translate-y-0 active:scale-[0.985] sm:px-4"
          >
            <SparkleIcon className="h-4 w-4" aria-hidden="true" />
            <span className="max-[374px]:sr-only sm:max-md:sr-only">Support us</span>
          </Link>
        </span>
      </div>
    </header>
  );
}
