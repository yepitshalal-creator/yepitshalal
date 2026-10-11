// How a food hygiene rating reads on the site. The ratings come from the Food
// Standards Agency (migration 0053, refreshed weekly). The words for each
// number are the FSA's own, so they match the sticker in the window.

export const HYGIENE_WORDS: Record<number, string> = {
  5: 'Very good',
  4: 'Good',
  3: 'Generally satisfactory',
  2: 'Improvement necessary',
  1: 'Major improvement necessary',
  0: 'Urgent improvement necessary',
};

/** The choices in the search filter. Null is "any", the default. */
export const HYGIENE_FILTERS: { min: number; label: string }[] = [
  { min: 5, label: '5 only' },
  { min: 4, label: '4 and up' },
  { min: 3, label: '3 and up' },
];

export function isHygieneMin(value: number): boolean {
  return HYGIENE_FILTERS.some((f) => f.min === value);
}

/** One row of restaurant_hygiene, as the place page reads it. */
export interface HygieneRecord {
  fhrs_id: number;
  rating_label: string;
  rating: number | null;
  rating_date: string | null;
  new_rating_pending: boolean;
  local_authority: string | null;
}

/** The FSA's page for this business, where anyone can check the rating. */
export function fsaUrl(fhrsId: number): string {
  return `https://ratings.food.gov.uk/business/${fhrsId}`;
}

/** What to say when the FSA has a record but no number for it yet. */
export function unratedLine(label: string): string | null {
  switch (label) {
    case 'AwaitingInspection':
      return 'Waiting for its first food hygiene inspection.';
    case 'AwaitingPublication':
      return 'Inspected. The rating is not out yet.';
    case 'Exempt':
      return 'Not part of the food hygiene rating scheme.';
    default:
      return null;
  }
}

/** "8 November 2025", for the date of an inspection. */
export function formatInspectionDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}
