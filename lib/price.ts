// Price a head, as an owner tells us. Never guessed from a menu, a cuisine or
// a postcode: with no answer from the owner, the price is not known and the
// card says nothing about it.

export const PRICE_RANGES: { value: number; signs: string; words: string }[] = [
  { value: 1, signs: '£', words: 'Under £10 a head' },
  { value: 2, signs: '££', words: '£10 to £20 a head' },
  { value: 3, signs: '£££', words: 'Over £20 a head' },
];

export function priceSigns(value: number | null | undefined): { signs: string; words: string } | null {
  return PRICE_RANGES.find((p) => p.value === value) ?? null;
}

/** "1,2" from a URL to [1, 2], keeping only real price values, smallest first. */
export function parsePriceList(raw: string | null): number[] {
  const wanted = new Set((raw ?? '').split(',').map(Number));
  return PRICE_RANGES.map((p) => p.value).filter((v) => wanted.has(v));
}
