// Builds index.html: the page template plus the English and German phrase data.
//   node build.mjs
// German phrases live in data/de/<level>.txt, one per line:
//   ru | words | distractors | alternatives | tip
// (alternatives are separated by " ; "; an empty field is allowed). A malformed line stops the build.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const levels = ['A2', 'B1', 'B2', 'C1'];
const problems = [];
const bag = list => [...list].sort().join(' ');

const german = [];
for (const level of levels) {
  const lines = read('data', 'de', level.toLowerCase() + '.txt').split(/\r?\n/).filter(line => line.trim());
  if (lines.length !== 40) problems.push(`${level}: ${lines.length} phrases, expected 40`);
  lines.forEach((line, index) => {
    const id = `de-${level.toLowerCase()}-${String(index + 1).padStart(2, '0')}`;
    const parts = line.split(' | ').map(part => part.trim());
    if (parts.length !== 5) { problems.push(`${id}: ${parts.length} fields`); return; }
    const [ru, phrase, extra, variants, tip] = parts;
    const words = phrase.split(/\s+/), distractors = extra ? extra.split(',').map(w => w.trim()).filter(Boolean) : [];
    const alternatives = variants ? variants.split(' ; ').map(v => v.trim().split(/\s+/)) : [];
    if (!ru || !tip || words.length < 3) problems.push(`${id}: empty prompt, tip or phrase`);
    if (distractors.length !== 2) problems.push(`${id}: ${distractors.length} distractors`);
    for (const d of distractors) if (words.includes(d)) problems.push(`${id}: distractor "${d}" is also a word of the phrase`);
    // An alternative is another order of the same tiles.
    for (const alt of alternatives) if (bag(alt) !== bag(words)) problems.push(`${id}: alternative "${alt.join(' ')}" uses other words`);
    if (alternatives.some(alt => alt.join(' ') === words.join(' '))) problems.push(`${id}: alternative repeats the phrase`);
    if ([words, ...alternatives].flat().concat(distractors).some(w => /[.,!?;:]/.test(w))) problems.push(`${id}: punctuation in tiles`);
    german.push({ id, ru, words, distractors, alternatives, tip, level });
  });
}
const prompts = german.map(e => e.ru);
prompts.forEach((ru, i) => { if (prompts.indexOf(ru) !== i) problems.push(`duplicate German prompt: ${ru}`); });

const english = read('data', 'en.json');
try { if (JSON.parse(english).length !== 160) problems.push('data/en.json: expected 160 phrases'); }
catch (error) { problems.push('data/en.json: ' + error.message); }

const template = read('src', 'trainer.template.html');
for (const mark of ['/*DATA*/', '/*DATA_DE*/']) {
  if (template.split(mark).length !== 2) problems.push(`template: placeholder ${mark} must appear exactly once`);
}
const germanJson = JSON.stringify(german);
// The data sits inside <script> tags, so it must not be able to close one.
if ((english + germanJson).includes('</')) problems.push('phrase data contains "</"');

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
const page = template.replace('/*DATA*/', () => english).replace('/*DATA_DE*/', () => germanJson);
writeFileSync(join(root, 'index.html'), page);
console.log(`index.html: ${Buffer.byteLength(page)} bytes; English ${JSON.parse(english).length} phrases, German ${german.length}`);
