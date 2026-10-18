// Inline SVG icon set, from Iconoir (MIT, iconoir.com), drawn on a 24px grid
// at 1.5 stroke with round caps and joins.
//
// Inlined rather than installed. The product needs about twenty five glyphs
// and Iconoir ships sixteen hundred, so a package would cost more bytes than
// the whole set and buy nothing. The licence is MIT and the attribution is
// here, in the file that uses them.
//
// Iconoir specifically because the previous set was drawn in the Phosphor
// idiom, which along with Lucide and Heroicons is what nearly every quickly
// built site uses. Iconoir has a thinner, more geometric hand that reads as
// drawn rather than picked, which is the same argument as the typeface change
// in app/layout.tsx.
//
// Every icon is `aria-hidden` by default: an icon is decoration unless the
// control around it says otherwise. When an icon is the *only* content of a
// button, put the meaning on the button (`aria-label`), not the glyph.

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

function Svg({
  className = 'h-5 w-5',
  strokeWidth = 1.5,
  children,
  fill = 'none',
}: IconProps & { children: React.ReactNode; fill?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M17 17L21 21" />
      <path d="M3 11C3 15.4183 6.58172 19 11 19C13.213 19 15.2161 18.1015 16.6644 16.6493C18.1077 15.2022 19 13.2053 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11Z" />
    </Svg>
  );
}

export function MapPinIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 10C20 14.4183 12 22 12 22C12 22 4 14.4183 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10Z" />
      <path d="M12 11C12.5523 11 13 10.5523 13 10C13 9.44772 12.5523 9 12 9C11.4477 9 11 9.44772 11 10C11 10.5523 11.4477 11 12 11Z" />
    </Svg>
  );
}

export function CrosshairIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19Z" />
      <path d="M12 19V21" />
      <path d="M5 12H3" />
      <path d="M12 5V3" />
      <path d="M19 12H21" />
    </Svg>
  );
}

export function MapIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 19L3.78974 20.7368C3.40122 20.8663 3 20.5771 3 20.1675L3 5.43246C3 5.1742 3.16526 4.94491 3.41026 4.86325L9 3M9 19L15 21M9 19L9 3M15 21L20.5897 19.1368C20.8347 19.0551 21 18.8258 21 18.5675L21 3.83246C21 3.42292 20.5988 3.13374 20.2103 3.26325L15 5M15 21L15 5M15 5L9 3" />
    </Svg>
  );
}

export function ListIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6L20 6" />
      <path d="M4 6.01L4.01 5.99889" />
      <path d="M4 12.01L4.01 11.9989" />
      <path d="M4 18.01L4.01 17.9989" />
      <path d="M8 12L20 12" />
      <path d="M8 18L20 18" />
    </Svg>
  );
}

export function ForkKnifeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 20H9M12 20H9M9 20V15" />
      <path d="M17 20V12C17 12 19.5 11 19.5 9C19.5 7.24264 19.5 4.5 19.5 4.5" />
      <path d="M17 8.5V4.5" />
      <path d="M4.49999 11C5.49991 13.1281 8.99999 15 8.99999 15C8.99999 15 12.5001 13.1281 13.5 11C14.5795 8.70257 13.5 4.5 13.5 4.5L4.49999 4.5C4.49999 4.5 3.42047 8.70257 4.49999 11Z" />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 13L9 17L19 7" />
    </Svg>
  );
}

export function ArrowDownIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3L12 21M12 21L18.5 14.5M12 21L5.5 14.5" />
    </Svg>
  );
}

export function PauseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 18.4V5.6C6 5.26863 6.26863 5 6.6 5H9.4C9.73137 5 10 5.26863 10 5.6V18.4C10 18.7314 9.73137 19 9.4 19H6.6C6.26863 19 6 18.7314 6 18.4Z" />
      <path d="M14 18.4V5.6C14 5.26863 14.2686 5 14.6 5H17.4C17.7314 5 18 5.26863 18 5.6V18.4C18 18.7314 17.7314 19 17.4 19H14.6C14.2686 19 14 18.7314 14 18.4Z" />
    </Svg>
  );
}

export function PlayIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.90588 4.53682C6.50592 4.2998 6 4.58808 6 5.05299V18.947C6 19.4119 6.50592 19.7002 6.90588 19.4632L18.629 12.5162C19.0211 12.2838 19.0211 11.7162 18.629 11.4838L6.90588 4.53682Z" />
    </Svg>
  );
}

export function MailIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 9L12 12.5L17 9" />
      <path d="M2 17V7C2 5.89543 2.89543 5 4 5H20C21.1046 5 22 5.89543 22 7V17C22 18.1046 21.1046 19 20 19H4C2.89543 19 2 18.1046 2 17Z" />
    </Svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9L12 15L18 9" />
    </Svg>
  );
}

export function SealCheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.5213 2.62368C11.3147 1.75255 12.6853 1.75255 13.4787 2.62368L14.4989 3.74391C14.8998 4.18418 15.4761 4.42288 16.071 4.39508L17.5845 4.32435C18.7614 4.26934 19.7307 5.23857 19.6757 6.41554L19.6049 7.92905C19.5771 8.52388 19.8158 9.10016 20.2561 9.50111L21.3763 10.5213C22.2475 11.3147 22.2475 12.6853 21.3763 13.4787L20.2561 14.4989C19.8158 14.8998 19.5771 15.4761 19.6049 16.071L19.6757 17.5845C19.7307 18.7614 18.7614 19.7307 17.5845 19.6757L16.071 19.6049C15.4761 19.5771 14.8998 19.8158 14.4989 20.2561L13.4787 21.3763C12.6853 22.2475 11.3147 22.2475 10.5213 21.3763L9.50111 20.2561C9.10016 19.8158 8.52388 19.5771 7.92905 19.6049L6.41553 19.6757C5.23857 19.7307 4.26934 18.7614 4.32435 17.5845L4.39508 16.071C4.42288 15.4761 4.18418 14.8998 3.74391 14.4989L2.62368 13.4787C1.75255 12.6853 1.75255 11.3147 2.62368 10.5213L3.74391 9.50111C4.18418 9.10016 4.42288 8.52388 4.39508 7.92905L4.32435 6.41553C4.26934 5.23857 5.23857 4.26934 6.41554 4.32435L7.92905 4.39508C8.52388 4.42288 9.10016 4.18418 9.50111 3.74391L10.5213 2.62368Z" />
      <path d="M9 12L11 14L15 10" />
    </Svg>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 12H17.4C17.7314 12 18 12.2686 18 12.6V19.4C18 19.7314 17.7314 20 17.4 20H6.6C6.26863 20 6 19.7314 6 19.4V12.6C6 12.2686 6.26863 12 6.6 12H8M16 12V8C16 6.66667 15.2 4 12 4C8.8 4 8 6.66667 8 8V12M16 12H8" />
    </Svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426" />
    </Svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6L12 12L18 12" />
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    </Svg>
  );
}

export function PhoneIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M18.1182 14.702L14 15.5C11.2183 14.1038 9.5 12.5 8.5 10L9.26995 5.8699L7.81452 2L4.0636 2C2.93605 2 2.04814 2.93178 2.21654 4.04668C2.63695 6.83 3.87653 11.8765 7.5 15.5C11.3052 19.3052 16.7857 20.9564 19.802 21.6127C20.9668 21.8662 22 20.9575 22 19.7655L22 16.1812L18.1182 14.702Z" />
    </Svg>
  );
}

export function GlobeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
      <path d="M2.5 12.5L8 14.5L7 18L8 21" />
      <path d="M17 20.5L16.5 18L14 17V13.5L17 12.5L21.5 13" />
      <path d="M19 5.5L18.5 7L15 7.5V10.5L17.5 9.5H19.5L21.5 10.5" />
      <path d="M2.5 10.5L5 8.5L7.5 8L9.5 5L8.5 3" />
    </Svg>
  );
}

export function NavigationIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path fillRule="evenodd" clipRule="evenodd" d="M17.8733 15.4753C18.3338 16.345 17.4362 17.3064 16.537 16.9067L11.9994 14.89L7.46178 16.9067C6.56256 17.3064 5.66499 16.345 6.12541 15.4753L11.0838 6.1095C11.4729 5.37447 12.5259 5.37448 12.915 6.1095L17.8733 15.4753Z" />
    </Svg>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 15C12.8747 15 15 12.949 15 8C15 12.949 17.1104 15 22 15C17.1104 15 15 17.1104 15 22C15 17.1104 12.8747 15 8 15Z" />
      <path d="M2 6.5C5.13376 6.5 6.5 5.18153 6.5 2C6.5 5.18153 7.85669 6.5 11 6.5C7.85669 6.5 6.5 7.85669 6.5 11C6.5 7.85669 5.13376 6.5 2 6.5Z" />
    </Svg>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 12L21 12M21 12L12.5 3.5M21 12L12.5 20.5" />
    </Svg>
  );
}

export function ArrowUpRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.00005 19L19 5.99996M19 5.99996V18.48M19 5.99996H6.52005" />
    </Svg>
  );
}

export function SlidersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.99961 3H19.9997C20.552 3 20.9997 3.44764 20.9997 3.99987L20.9999 5.58569C21 5.85097 20.8946 6.10538 20.707 6.29295L14.2925 12.7071C14.105 12.8946 13.9996 13.149 13.9996 13.4142L13.9996 19.7192C13.9996 20.3698 13.3882 20.8472 12.7571 20.6894L10.7571 20.1894C10.3119 20.0781 9.99961 19.6781 9.99961 19.2192L9.99961 13.4142C9.99961 13.149 9.89425 12.8946 9.70672 12.7071L3.2925 6.29289C3.10496 6.10536 2.99961 5.851 2.99961 5.58579V4C2.99961 3.44772 3.44732 3 3.99961 3Z" />
    </Svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 11.5V16.5" />
      <path d="M12 7.51L12.01 7.49889" />
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    </Svg>
  );
}

export function HeartHandIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 8.86222C22 10.4087 21.4062 11.8941 20.3458 12.9929C17.9049 15.523 15.5374 18.1613 13.0053 20.5997C12.4249 21.1505 11.5042 21.1304 10.9488 20.5547L3.65376 12.9929C1.44875 10.7072 1.44875 7.01723 3.65376 4.73157C5.88044 2.42345 9.50794 2.42345 11.7346 4.73157L11.9998 5.00642L12.2648 4.73173C13.3324 3.6245 14.7864 3 16.3053 3C17.8242 3 19.2781 3.62444 20.3458 4.73157C21.4063 5.83045 22 7.31577 22 8.86222Z" />
    </Svg>
  );
}

/** The same heart, filled when `filled`: a saved place. */
export function HeartIcon({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
      <path d="M22 8.86222C22 10.4087 21.4062 11.8941 20.3458 12.9929C17.9049 15.523 15.5374 18.1613 13.0053 20.5997C12.4249 21.1505 11.5042 21.1304 10.9488 20.5547L3.65376 12.9929C1.44875 10.7072 1.44875 7.01723 3.65376 4.73157C5.88044 2.42345 9.50794 2.42345 11.7346 4.73157L11.9998 5.00642L12.2648 4.73173C13.3324 3.6245 14.7864 3 16.3053 3C17.8242 3 19.2781 3.62444 20.3458 4.73157C21.4063 5.83045 22 7.31577 22 8.86222Z" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 12H12M18 12H12M12 12V6M12 12V18" />
    </Svg>
  );
}

/** A shop front: an awning over a door. For the way in for restaurant owners. */
export function StoreIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 9L4.5 4H19.5L21 9H3Z" />
      <path d="M3 9C3 10.6569 4.34315 12 6 12C7.65685 12 9 10.6569 9 9C9 10.6569 10.3431 12 12 12C13.6569 12 15 10.6569 15 9C15 10.6569 16.3431 12 18 12C19.6569 12 21 10.6569 21 9" />
      <path d="M5 12V20H19V12" />
      <path d="M10 20V16H14V20" />
    </Svg>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 20V19C5 15.134 8.13401 12 12 12V12C15.866 12 19 15.134 19 19V20" />
      <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" />
    </Svg>
  );
}

export function WarningIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20.0429 21H3.95705C2.41902 21 1.45658 19.3364 2.22324 18.0031L10.2662 4.01533C11.0352 2.67792 12.9648 2.67791 13.7338 4.01532L21.7768 18.0031C22.5434 19.3364 21.581 21 20.0429 21Z" />
      <path d="M12 9V13" />
      <path d="M12 17.01L12.01 16.9989" />
    </Svg>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 9L18.005 20.3463C17.8369 21.3026 17.0062 22 16.0353 22H7.96474C6.99379 22 6.1631 21.3026 5.99496 20.3463L4 9" />
      <path d="M21 6L15.375 6M3 6L8.625 6M8.625 6V4C8.625 2.89543 9.52043 2 10.625 2H13.375C14.4796 2 15.375 2.89543 15.375 4V6M8.625 6L15.375 6" />
    </Svg>
  );
}

export function StarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8.58737 8.23597L11.1849 3.00376C11.5183 2.33208 12.4817 2.33208 12.8151 3.00376L15.4126 8.23597L21.2215 9.08017C21.9668 9.18848 22.2638 10.0994 21.7243 10.6219L17.5217 14.6918L18.5135 20.4414C18.6409 21.1798 17.8614 21.7428 17.1945 21.3941L12 18.678L6.80547 21.3941C6.1386 21.7428 5.35909 21.1798 5.48645 20.4414L6.47825 14.6918L2.27575 10.6219C1.73617 10.0994 2.03322 9.18848 2.77852 9.08017L8.58737 8.23597Z" />
    </Svg>
  );
}

export function InstagramIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" />
      <path d="M3 16V8C3 5.23858 5.23858 3 8 3H16C18.7614 3 21 5.23858 21 8V16C21 18.7614 18.7614 21 16 21H8C5.23858 21 3 18.7614 3 16Z" />
      <path d="M17.5 6.51L17.51 6.49889" />
    </Svg>
  );
}

export function ChatIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" />
    </Svg>
  );
}

// Halal status marks. These are fill-based rather than stroke-based, and they
// carry the meaning themselves: solid = all of the menu; half-filled = some of
// it; dashed-and-empty = signs, not confirmed; a ring with a bar = worth
// asking. That reads before the words do, and the four are still
// distinguishable with no colour at all, which colour-coded dots were not.
//
// No tick in any of them. Shabir, 2026-09-24: "reserve the tick". A tick reads
// as "we checked", and a Fully Halal label usually rests on the restaurant's
// own words, so the tick belongs only to the Checked by us seal
// (CheckedByUsBadge), which only our own check can earn.
export function HalalFullMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      {/* The same outer edge as the half-filled mark (8.6 plus half its 1.9 ring). */}
      <circle cx="10" cy="10" r="9.55" fill="currentColor" />
    </svg>
  );
}

export function HalalPartialMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      {/* Left half solid, right half open: "some of the menu, not all of it". */}
      <path d="M10 1.4a8.6 8.6 0 0 0 0 17.2Z" fill="currentColor" />
      <circle cx="10" cy="10" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function HalalUnknownMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <circle
        cx="10"
        cy="10"
        r="8.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeDasharray="3.1 3.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Not checked yet: an empty ring with a short bar, "no reading". Distinct from
// the dashed Unverified ring, which means there are signs but no confirmation.
export function HalalNotCheckedMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
      <path d="M6.6 10h6.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

// Added for the admin dashboard, drawn to the same 24px grid and stroke.

export function GridIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function InboxIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 13H7.5L9 15.5H15L16.5 13H21" />
      <path d="M3 13L5.5 5.6C5.8 4.7 6.6 4 7.6 4H16.4C17.4 4 18.2 4.7 18.5 5.6L21 13V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V13Z" />
    </Svg>
  );
}

export function ChartIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4V20H20" />
      <path d="M8 15L11.5 10.5L14.5 13L19 7" />
    </Svg>
  );
}

export function ReplyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 14L4.5 9L9.5 4" />
      <path d="M4.5 9H14C17.04 9 19.5 11.46 19.5 14.5C19.5 17.54 17.04 20 14 20H11" />
    </Svg>
  );
}

export function ArchiveIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M5 8.5V18C5 19.1 5.9 20 7 20H17C18.1 20 19 19.1 19 18V8.5" />
      <path d="M10 12.5H14" />
    </Svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7H20" />
      <path d="M4 12H20" />
      <path d="M4 17H20" />
    </Svg>
  );
}

export function ArrowLeftIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 12H5" />
      <path d="M11 6L5 12L11 18" />
    </Svg>
  );
}

export function TicketIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7C4 5.9 4.9 5 6 5H18C19.1 5 20 5.9 20 7V9.5C18.6 9.5 17.5 10.6 17.5 12C17.5 13.4 18.6 14.5 20 14.5V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V14.5C5.4 14.5 6.5 13.4 6.5 12C6.5 10.6 5.4 9.5 4 9.5V7Z" />
      <path d="M10 9.5L14 14.5" />
      <path d="M10 9.6H10.01" />
      <path d="M14 14.4H14.01" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 19.5C2.5 16.46 4.96 14 8 14H10C13.04 14 15.5 16.46 15.5 19.5" />
      <path d="M9 11C10.93 11 12.5 9.43 12.5 7.5C12.5 5.57 10.93 4 9 4C7.07 4 5.5 5.57 5.5 7.5C5.5 9.43 7.07 11 9 11Z" />
      <path d="M17 14C19.49 14 21.5 16.01 21.5 18.5" />
      <path d="M15.5 4.2C17 4.7 18 6 18 7.5C18 9 17 10.3 15.5 10.8" />
    </Svg>
  );
}

export function CoinsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <ellipse cx="9" cy="7" rx="6" ry="2.5" />
      <path d="M3 7V11.5C3 12.88 5.69 14 9 14C12.31 14 15 12.88 15 11.5V7" />
      <path d="M3 11.5V16C3 17.38 5.69 18.5 9 18.5C10.1 18.5 11.13 18.38 12 18.16" />
      <path d="M15 14.5C18.31 14.5 21 13.38 21 12" />
      <path d="M21 12V17C21 18.38 18.31 19.5 15 19.5C11.69 19.5 9 18.38 9 17" />
    </Svg>
  );
}

export function PulseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 12H7L9.5 6L14.5 18L17 12H21" />
    </Svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" />
      <path d="M19.62 10.45L18.52 7.81L19.57 5.57L18.43 4.43L16.19 5.48L13.55 4.38L12.8 2H11.2L10.45 4.38L7.81 5.48L5.57 4.43L4.43 5.57L5.48 7.81L4.38 10.45L2 11.2V12.8L4.38 13.55L5.48 16.19L4.43 18.43L5.57 19.57L7.81 18.52L10.45 19.62L11.2 22H12.8L13.55 19.62L16.19 18.52L18.43 19.57L19.57 18.43L18.52 16.19L19.62 13.55L22 12.8V11.2L19.62 10.45Z" />
    </Svg>
  );
}

export function CopyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5V5.5C15.5 4.4 14.6 3.5 13.5 3.5H5.5C4.4 3.5 3.5 4.4 3.5 5.5V13.5C3.5 14.6 4.4 15.5 5.5 15.5H8.5" />
    </Svg>
  );
}
