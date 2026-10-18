'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { track } from '@/lib/analytics/posthog';
import { NavigationIcon } from './icons';

// "Fully Halal near me", one tap. It asks the browser for a location, never
// stores one, and opens search filtered to Fully Halal (app/search reads
// `only`). A refusal is an answer, not an error: it goes to the homepage
// search, where a postcode works just as well.
export function FullyHalalNearButton({ className }: { className?: string }) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [searching, startSearch] = useTransition();

  function locate() {
    track('browse_fully_halal_near_me');
    if (!('geolocation' in navigator)) {
      router.push('/');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocating(false);
        startSearch(() =>
          router.push(
            `/search?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}&mode=current_location&label=Your location&only=fully_halal`
          )
        );
      },
      () => {
        setLocating(false);
        router.push('/');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <button type="button" onClick={locate} disabled={locating || searching} aria-live="polite" className={className}>
      <NavigationIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {locating ? 'Finding you…' : searching ? 'Finding places…' : 'Fully Halal near me'}
    </button>
  );
}
