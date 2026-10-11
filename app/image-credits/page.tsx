import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { inlineLink, noteWarm, pageShell, sectionTitle } from '@/components/prose';
import { allRepresentativeImages } from '@/lib/representativeImages';
import { isUnsplash, skipOptimiser, thumbUrl, unsplashSized } from '@/lib/imageUrl';

export const metadata: Metadata = {
  title: 'Image credits',
  description: 'Who took the example food photos shown on YepItsHalal, and the licence each is used under.',
  alternates: { canonical: '/image-credits' },
};

const BUCKET_NAME: Record<string, string> = {
  kebab: 'Kebab', biryani: 'Biryani', curry: 'Curry', shawarma: 'Shawarma', fried_chicken: 'Fried chicken',
  burgers: 'Burgers', middle_eastern: 'Middle Eastern', bakery: 'Bakery and sweets', grill: 'Grill',
  persian: 'Persian', afghan: 'Afghan', moroccan: 'Moroccan', turkish: 'Turkish', african: 'African',
  caribbean: 'Caribbean', central_asian: 'Central Asian', balkan: 'Balkan', malaysian: 'Malaysian',
  chinese: 'Chinese', indo_chinese: 'Indo-Chinese', thai: 'Thai', japanese: 'Japanese', korean: 'Korean',
  pizza: 'Pizza', italian: 'Italian', mediterranean: 'Mediterranean', fish_and_chips: 'Fish and chips',
  desserts: 'Desserts', cafe: 'Cafe', sandwiches: 'Wraps and sandwiches',
};

// Generated on 2026-09-23 and 2026-09-24. Listed so nobody has to guess which
// pictures are photographs of real places and which are not. Keep "where"
// current whenever a picture is reused (lib/media.ts is where they are set).
const MADE_FOR_SITE: [string, string][] = [
  ['A London high street at dusk, still and short loops', 'The homepage, Discover, Add a restaurant, Halal restaurants in London, Support'],
  ['A menu, notes and a pen on a counter', 'How we label places, Support'],
  ['Hands writing notes at a desk, still and short loop', 'Support'],
  ['Hands sharing dishes across a restaurant table, still and short loop', 'Support'],
  ['An empty prayer room', 'Prayer spaces, Discover'],
  ['A plate set down on a kitchen pass, still and short loop', 'For restaurants'],
];

export default function ImageCreditsPage() {
  const groups = allRepresentativeImages().sort((a, b) => (BUCKET_NAME[a.bucket] ?? a.bucket).localeCompare(BUCKET_NAME[b.bucket] ?? b.bucket));

  return (
    <>
      <PageHero
        tone="sand"
        title="Image credits"
        lede="When a restaurant hasn't sent us its own photos, we show one of these pictures of the kind of food it serves, marked as an example. None of them shows a particular restaurant's food. Thank you to everyone who shared them."
      />
      <div className={`${pageShell} pb-4 pt-10 sm:pt-14`}>
      <div className={`max-w-2xl ${noteWarm}`}>
        <h2 className="font-display text-lg font-semibold text-ink">Photos of the restaurants themselves</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          A listing shows the restaurant&apos;s own picture when it publishes one: the image it puts
          in its website&apos;s preview tag, the same one that appears when somebody shares a link to
          it. Those are credited on the listing with a link back to the site they came from, and we
          only ever take them from a restaurant&apos;s own website, never from Google, Tripadvisor or
          a delivery app.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If you own one of those pictures and would rather we did not show it, tell us and it comes
          down the same day.{' '}
          <Link href="/corrections" className={inlineLink}>
            Send us a message
          </Link>
          , or send a better photo and we will use that instead.
        </p>
      </div>


      <section aria-labelledby="made" className="mt-10 max-w-2xl border-t border-line pt-8">
        <h2 id="made" className={sectionTitle}>
          Pictures made for this site
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A few pictures on the site were generated for YepItsHalal with Higgsfield, an image and
          video tool. They show no real restaurant, mosque or person, and none of them
          is ever used as a photo of a listed place.
        </p>
        <ul className="mt-4 border-b border-line text-sm">
          {MADE_FOR_SITE.map(([what, where]) => (
            <li key={what} className="flex flex-wrap justify-between gap-x-6 gap-y-0.5 border-t border-line py-3">
              <span className="text-ink">{what}</span>
              <span className="text-muted">{where}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 max-w-2xl border-t border-line pt-8 text-sm leading-relaxed text-muted">
        The example photos below are used when a restaurant publishes nothing of its own. Those from
        Wikimedia Commons are resized and used under the licence shown, which links to its terms;
        follow the title for the original. Photos from Unsplash are used under the{' '}
        <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer" className={inlineLink}>
          Unsplash licence
        </a>
        . Run a restaurant?{' '}
        <Link href="/submit-restaurant" className={inlineLink}>
          Send us your own photos
        </Link>
        .
      </p>

      {groups.map(({ bucket, images }) => (
        <Reveal as="section" key={bucket} aria-labelledby={`b-${bucket}`} className="mt-12">
          <h2 id={`b-${bucket}`} className={sectionTitle}>
            {BUCKET_NAME[bucket] ?? bucket}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {images.map((img, i) => (
              <li key={`${img.src}-${i}`} className="flex gap-3 rounded-xl border border-line bg-white p-2.5">
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-halal-unverifiedSoft">
                  <Image src={isUnsplash(img.src) ? unsplashSized(img.src, 240, 180) : thumbUrl(img.src)} alt="" fill sizes="80px" unoptimized={skipOptimiser(img.src)} className="object-cover" />
                </div>
                <div className="min-w-0 text-xs leading-relaxed text-muted">
                  {img.source === 'wikimedia' ? (
                    <>
                      <a href={img.page} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-semibold text-ink hover:underline">
                        {img.title}
                      </a>
                      <p className="line-clamp-2 break-words">{img.author ? `By ${img.author}` : 'Author not recorded'}</p>
                      <p>
                        {img.licenceUrl ? (
                          <a href={img.licenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                            {img.licence}
                          </a>
                        ) : (
                          img.licence
                        )}
                        {' · Wikimedia Commons'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-ink">Photo from Unsplash</p>
                      <p>Unsplash licence</p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
      </div>
    </>
  );
}
