import { formatCheckedDate } from '@/components/HalalEvidencePanel';
import type { HalalStatus } from './types';
import { foodKind } from './whyListed';

/**
 * The answer to "is this halal?", in one sentence, in the same words everywhere.
 *
 * The question people type is "is X halal", so that is the question the page
 * answers: in its title, in its description, in the heading above the evidence,
 * and in the FAQ markup that answer engines read. One function so those four
 * can never drift apart and say four different things about one restaurant.
 *
 * It never says more than the evidence does. "Yes" only appears for a place
 * with strong evidence that all its meat is halal; everything else says what is
 * actually known, and every answer ends by pointing at the restaurant itself.
 *
 * Written short on purpose. Every sentence is one idea, because this text is
 * read on a phone, translated by browsers and spoken aloud by assistants.
 */

export interface HalalAnswer {
  /** "Yes", "Partly", "Not confirmed", "Worth asking". The short answer. */
  verdict: string;
  /** Several short sentences, safe to publish anywhere. */
  sentence: string;
}

export function halalAnswerFor(options: {
  name: string;
  status: HalalStatus | null;
  summary: string | null;
  checkedAt: string | null;
  /** Why an unchecked place is here at all. Ignored for every other status. */
  cuisine?: string | null;
}): HalalAnswer {
  const { name, status, summary } = options;
  const because = summary ? `${summary.replace(/\.$/, '')}.` : '';
  const checked = options.checkedAt ? ` Last checked ${formatCheckedDate(options.checkedAt)}.` : '';

  switch (status) {
    case 'fully_halal':
      return {
        verdict: 'Yes',
        sentence: `Yes. There is strong evidence that all the meat at ${name} is halal. ${because}${checked} Ask them when you order.`.replace(/\s+/g, ' '),
      };
    case 'halal_options':
      return {
        verdict: 'Partly',
        sentence: `Partly. ${name} serves halal food, and food that is not halal. ${because}${checked} Ask for the halal dishes when you order.`.replace(/\s+/g, ' '),
      };
    case 'unverified':
      return {
        verdict: 'Not confirmed',
        sentence: `We cannot confirm it. There are signs that ${name} serves halal food, but nobody has checked. ${because}${checked} Unverified never means not halal. Ask them when you order.`.replace(/\s+/g, ' '),
      };
    case 'unknown': {
      // Lead with the reason it is on a halal site, because the reader's real
      // question here is not "have you checked" but "why am I looking at this".
      const why = options.cuisine
        ? `It serves ${foodKind(options.cuisine)}, which is often halal in London.`
        : 'It serves a kind of food that is often halal in London.';
      return {
        verdict: 'Worth asking',
        sentence: `Worth asking. ${why} Nobody has checked ${name}. We have not found anything said about its meat, by them or by anyone else. That is a reason to ask, not an answer.`,
      };
    }
    default:
      return {
        verdict: 'Not known',
        sentence: `We have nothing either way about ${name}. That does not mean it is not halal. It means we cannot tell you.`,
      };
  }
}
