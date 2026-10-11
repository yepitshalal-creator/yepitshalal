import { readFileSync } from 'node:fs';
import { CONTRADICTIONS } from '../page-text.mjs';

// Line endings made even: a Windows checkout has CRLF, and pick() ends each
// pattern at a semicolon followed by LF.
const src = readFileSync(new URL('../classify-evidence.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const pick = (name) => {
  const start = src.indexOf(`const ${name} = `);
  const end = src.indexOf(';\n', start);
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
];

let failed = 0;
for (const [name, re, text, expected] of cases) {
  const got = any(re, text);
  if (got !== expected) failed++;
  console.log(`${got === expected ? 'ok  ' : 'FAIL'} ${name.padEnd(12)} ${text}`);
}
console.log(failed ? `${failed} failed` : 'all passed');
if (failed) process.exitCode = 1;
