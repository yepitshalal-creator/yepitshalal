'use client';

import { ErrorScreen } from '@/components/ErrorScreen';

export default function SearchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      title="Sorry, the places did not load"
      lede="Our site was slow for a moment. Tap Try again. It usually works the second time."
    />
  );
}
