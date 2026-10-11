'use client';

import { ErrorScreen } from '@/components/ErrorScreen';

// Any page that fails to load lands here, inside the site's own header and
// footer. Search has its own words in app/search/error.tsx.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      title="Sorry, this page did not load"
      lede="Something went wrong on our side. Tap Try again."
    />
  );
}
