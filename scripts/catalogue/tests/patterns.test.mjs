import { readFileSync } from 'node:fs';
import { alcoholMentions, CONTRADICTIONS } from '../page-text.mjs';

// Line endings made even: a Windows checkout has CRLF, and pick() ends each
// pattern at a semicolon followed by LF.
const src = readFileSync(new URL('../classify-evidence.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const pick = (name) => {
  const start = src.indexOf(`const ${name} = `);
  // A Windows checkout ends its lines in \r\n.
  const end = start + src.slice(start).search(/;\r?\n/);
  return new Function(`return ${src.slice(start + `const ${name} = `.length, end)};`)();
};
const NEGATIVE = pick('NEGATIVE');
const PARTIAL_NOT = pick('PARTIAL_NOT');
const NEGATED = pick('NEGATED');
const CERT_CLAIM = pick('CERT_CLAIM');
const FULLY = pick('FULLY');
const POSITIVE = pick('POSITIVE');
const TESTIMONIAL = pick('TESTIMONIAL');
const REVIEW_WIDGET = pick('REVIEW_WIDGET');
const any = (re, x) => [].concat(re).some((r) => r.test(x));
// True when the text says alcohol is served, not merely named.
const ALCOHOL_SERVED = { test: (x) => alcoholMentions(x).some((m) => m.served) };

const cases = [
  ['NEGATIVE', NEGATIVE, 'Our dishes are not Halal.', true],
  ['NEGATIVE', NEGATIVE, "I'm afraid our meat is not halal, but we offer seafood", true],
  ['NEGATIVE', NEGATIVE, 'we are not halal certified but all our meat is halal', false],
  ['NEGATIVE', NEGATIVE, 'we are not halal-certified as pork is also used', false],
  ['NEGATIVE', NEGATIVE, "We don't serve halal meat", true],
  ['PARTIAL_NOT', PARTIAL_NOT, 'Our chicken wings are not halal.', true],
  ['PARTIAL_NOT', PARTIAL_NOT, 'our kitchen is not halal certified', false],
  ['NEGATED', NEGATED, 'No pork served', true],
  ['NEGATED', NEGATED, 'Vegan Roll (Pork Free)', true],
  ['NEGATED', NEGATED, 'zero contact with non-Halal elements', true],
  ['NEGATED', NEGATED, "as we don't handle any pork ingredients", true],
  ['NEGATED', NEGATED, 'Pork Pibil . 7.95', false],
  ['NEGATED', NEGATED, 'serve non-halal meat, pork products and alcohol', false],
  ['CERT_CLAIM', CERT_CLAIM, 'Halal-certified meats. No pork served', true],
  ['CERT_CLAIM', CERT_CLAIM, 'All our meat is HMC certified', true],
  ['FULLY', FULLY, 'All our meat is 100% halal', true],
  ['FULLY', FULLY, 'We are a fully halal restaurant', true],
  ['FULLY', FULLY, 'Halal options available', false],
  // 2026-09-24, from reading the rendered crawl.
  ['POSITIVE', POSITIVE, 'Halal indian & Sri Lankan Food restaurant Wembley.', true],
  ['POSITIVE', POSITIVE, 'Enjoy peri peri chicken, grilled chicken, halal fast food, burgers and more', true],
  ['POSITIVE', POSITIVE, 'Halal Monitoring Committee', false],
  ['TESTIMONIAL', TESTIMONIAL, 'I had a lovely experience at Baba Ghanouj, this place is a must-visit', true],
  ['TESTIMONIAL', TESTIMONIAL, 'so I am so happy to find a PURE VEG restaurant, I hope it stays this way', true],
  ['TESTIMONIAL', TESTIMONIAL, "I'm afraid our meat is not halal, but we offer seafood", false],
  ['TESTIMONIAL', TESTIMONIAL, 'All our meats and chicken are halal.', false],
  ['CONTRADICTION', CONTRADICTIONS.bacon, '"Whoever is out of patience is out of possession of their soul." Francis Bacon', false],
  ['CONTRADICTION', CONTRADICTIONS.bacon, 'Smoky BBQ Bacon Burger', true],
  ['CONTRADICTION', CONTRADICTIONS.bacon, 'halal beef bacon, Cheddar cheese', false],
  ['NEGATIVE', NEGATIVE, 'We do not offer halal beef at any of our restaurants.', false],
  ['PARTIAL_NOT', PARTIAL_NOT, 'We do not offer halal beef at any of our restaurants.', true],
  ['NEGATIVE', NEGATIVE, "We don't serve halal food", true],
  ['POSITIVE', POSITIVE, 'As one of the top halal restaurants in Wood Green, we serve fresh dishes', true],
  ['REVIEW_WIDGET', REVIEW_WIDGET, 'Nice halal pizza takeaway. Posted on Google. KD. Trustindex verifies that the original source of the review is Google.', true],
  ['REVIEW_WIDGET', REVIEW_WIDGET, 'All our meat is halal and we serve it fresh every day.', false],
  // 2026-09-28: alcohol served is a contradiction of fully halal.
  ['ALCOHOL', ALCOHOL_SERVED, 'Our bar serves a wide range of cocktails, wines and beers.', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Please note that alcohol is served on the premises.', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Fully licensed. Halal meat only.', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Why not try our cocktail menu?', true],
  ['ALCOHOL', ALCOHOL_SERVED, "Don't miss our wine list", true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Gin & tonic 8.50', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'We do not serve alcohol.', false],
  ['ALCOHOL', ALCOHOL_SERVED, '100% halal, no pork, no alcohol', false],
  ['ALCOHOL', ALCOHOL_SERVED, "We don't serve pork or alcohol", false],
  ['ALCOHOL', ALCOHOL_SERVED, 'An alcohol-free family restaurant', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Alcohol is not served here.', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Alcohol: No', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Non-alcoholic cocktails and fresh juices', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Virgin mojito 4.50', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Alcohol free beer 0.0%', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Ginger beer, lemonade, mango lassi', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Prawn cocktail starter', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'dressed with red wine vinegar', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Wine and dine with the family', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Fresh ginger and garlic, rump steak', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Kale salad on sale, for the sake of taste', false],
  // From the 2026-09-28 re-read of the Fully Halal sites.
  ['ALCOHOL', ALCOHOL_SERVED, 'We don’t use any alcohol in any of our cakes', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Do you serve alcohol? No. We are a completely alcohol-free restaurant.', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'DO YOU SERVE ALCOHOL? Yes. Gallio serves wine with its food.', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Is your food halal? Can we have alcohol on the premises? Can I order for', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Who needs alcohol when you can enjoy one of our mocktails', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'paired with our signature none alcohol cocktails', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Rare teas and sophisticated dry cocktails', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'garlic, chilli, cocktail sauce and more', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'be it a cocktail reception or sit down dinner', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Sulphites Found in dried fruits, wine, beer, and soft drinks.', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Now we are serving alcohol', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Is the food halal at Blacklist? Does Blacklist sell alcohol? How long', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Our entire restaurant is strictly and proudly free of alcohol.', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Cocktail Samosa, Onion Bhaji', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Cocktail Shrimps with a Marie Rose sauce', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Allergen Info + ALCOHOL £5.25 Birra Moretti Can', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Are you fully licensed? Yes we are fully licensed, wine, beer.', true],
  ['ALCOHOL', ALCOHOL_SERVED, 'Can we have alcohol on the premises? ❌ No, we don’t have an alcohol license, so alcohol is not permitted on-site.', false],
  ['ALCOHOL', ALCOHOL_SERVED, 'Do you serve alcohol? ✅ Yes, a full wine list.', true],
];

let failed = 0;
for (const [name, re, text, expected] of cases) {
  const got = any(re, text);
  if (got !== expected) failed++;
  console.log(`${got === expected ? 'ok  ' : 'FAIL'} ${name.padEnd(12)} ${text}`);
}
console.log(failed ? `${failed} failed` : 'all passed');
if (failed) process.exitCode = 1;
