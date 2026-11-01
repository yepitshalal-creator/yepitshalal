import type { HalalEvidence, HalalFactsPublic, HalalStatus } from './types';

// The three answers a diner looks for first, as three short tiles at the top
// of a place's page: is it halal, is there alcohol, who certifies it.
//
// The idea comes from HalalaGo (halalago.co.uk, read 2026-11-01), whose
// listings open on "Halal Status", "Alcohol Status" and "Halal Certification".
// Until now ours showed alcohol and certification only after our own check,
// which no place has had, so nobody saw them. Most places do have something
// to say: the alcohol pass of 2026-10-24 read every Fully Halal website for
// alcohol, and 156 places' websites say they are certified.
//
// Each tile says only what the evidence says, and where from. Unknown is
// "Not known", never "No" (the vault's "Never fabricate halal facts"). The
// unread word-match notes ("also mentions pork") are never shown, the same
// rule as migration 0056.

export type GlanceTone = 'good' | 'warn' | 'neutral';

export interface GlanceTile {
  label: string;
  value: string;
  /** Where the answer comes from, or what to do about it. */
  source: string;
  tone: GlanceTone;
}

export function halalTile(status: HalalStatus): GlanceTile {
  switch (status) {
    case 'fully_halal':
      return { label: 'Halal', value: 'All the meat', source: 'Fully Halal', tone: 'good' };
    case 'halal_options':
      return { label: 'Halal', value: 'Some of it', source: 'Halal food available', tone: 'warn' };
    default:
      return { label: 'Halal', value: 'Not confirmed', source: 'Unverified', tone: 'neutral' };
  }
}

const OWN_WORDS = new Set(['first_party_statement']);

export function alcoholTile(status: HalalStatus, facts: HalalFactsPublic | null, evidence: HalalEvidence[]): GlanceTile {
  const label = 'Alcohol';
  if (facts?.serves_alcohol === true) return { label, value: 'Served', source: 'Our own check', tone: 'warn' };
  if (facts?.serves_alcohol === false) return { label, value: 'Not served', source: 'Our own check', tone: 'good' };
  const options = evidence.filter((e) => e.claim === 'halal_options' && e.notes);
  if (options.some((e) => /bring their own alcohol/i.test(e.notes as string))) {
    return { label, value: 'Bring your own', source: 'Its website says so', tone: 'warn' };
  }
  if (options.some((e) => /alcohol/i.test(e.notes as string))) {
    return { label, value: 'Mentioned', source: 'On its website', tone: 'warn' };
  }
  // Fully Halal rules alcohol out (2026-10-24), and every Fully Halal website
  // was read for it that day.
  if (status === 'fully_halal') {
    const fromSite = evidence.some((e) => e.claim === 'fully_halal' && OWN_WORDS.has(e.kind));
    return { label, value: 'No sign of it', source: fromSite ? 'On its website' : 'Fully Halal rules it out', tone: 'good' };
  }
  return { label, value: 'Not known', source: 'Ask them', tone: 'neutral' };
}

/** HMC and HFA by name, when a claim names them. Anyone else stays unnamed. */
export function certifierIn(text: string | null): string | null {
  if (!text) return null;
  if (/\bHMC\b|halal monitoring committee/i.test(text)) return 'HMC';
  if (/\bHFA\b|halal food authority/i.test(text)) return 'HFA';
  return null;
}

export function certificateTile(facts: HalalFactsPublic | null, evidence: HalalEvidence[]): GlanceTile {
  const label = 'Certificate';
  // Only the certifier's own list makes it confirmed (lib/admin/save-check.ts).
  const listed = evidence.find((e) => e.kind === 'certification');
  if (listed) return { label, value: 'Confirmed', source: `On ${listed.source_name}'s list`, tone: 'good' };
  if (facts?.has_certification === true) {
    return { label, value: 'They say so', source: facts.certification_body ? `${facts.certification_body}, not checked` : 'Not checked', tone: 'neutral' };
  }
  const claim = evidence.find((e) => e.kind === 'certification_claim');
  if (claim) {
    const who = certifierIn(claim.excerpt);
    return { label, value: 'They say so', source: who ? `${who}, not checked` : 'Not checked with anyone', tone: 'neutral' };
  }
  return { label, value: 'Not known', source: 'Ask them', tone: 'neutral' };
}

export function glanceTiles(status: HalalStatus, facts: HalalFactsPublic | null, evidence: HalalEvidence[]): GlanceTile[] {
  return [halalTile(status), alcoholTile(status, facts, evidence), certificateTile(facts, evidence)];
}
