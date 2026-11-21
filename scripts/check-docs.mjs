// Checks the pages of docs/ (run by the root `npm run lint`):
// - no reference to the plan (decision letters, lots, rounds: the eslint rule `ordo/no-plan-references`) nor dated
//   history (« demande du 2026-11-20 », « série du … ») — a page says the rule as it stands;
// - every relative link reaches an existing file, and its anchor an existing heading.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAN_REFERENCE } from '../packages/shared/eslint-rules.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

/** Dated history: a request, a decision or an answer « du <date> », a round « série du … ». */
const DATED_HISTORY = /\b(?:demande|décision|réponses?)\s+(?:de l.utilisateur\s+)?du\s+\d|\bsérie du\b/i;

/**
 * Markdown files under a folder, recursively.
 * @param {string} dir
 * @returns {string[]}
 */
function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

/**
 * Lines of a page outside fenced code blocks, with their number.
 * @param {string} text
 * @returns {{ line: string, number: number }[]}
 */
function proseLines(text) {
  let fenced = false;
  return text.split('\n').flatMap((line, index) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return [];
    }
    return fenced ? [] : [{ line, number: index + 1 }];
  });
}

/**
 * GitHub anchor of a heading: lower case, punctuation dropped, each space a hyphen.
 * @param {string} heading
 * @returns {string}
 */
function slugOf(heading) {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * Anchors of a page, duplicates numbered as GitHub does (`-1`, `-2`…).
 * @param {string} text
 * @returns {Set<string>}
 */
function anchorsOf(text) {
  const seen = new Map();
  const anchors = new Set();
  for (const { line } of proseLines(text)) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    const slug = slugOf(heading[1]);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count ? `${slug}-${count}` : slug);
  }
  return anchors;
}

const files = markdownFiles(DOCS);
const texts = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
const anchorCache = new Map();
const problems = [];

for (const [file, text] of texts) {
  const where = (number) => `${relative(ROOT, file)}:${number}`;
  for (const { line, number } of proseLines(text)) {
    if (PLAN_REFERENCE.test(line) || DATED_HISTORY.test(line)) problems.push(`${where(number)} : référence au plan ou historique datée`);
    for (const [, target] of line.replace(/`[^`]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      const [path, anchor] = target.split('#');
      const linked = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
      if (!existsSync(linked)) {
        problems.push(`${where(number)} : lien cassé ${target}`);
        continue;
      }
      if (!anchor || !linked.endsWith('.md')) continue;
      if (!anchorCache.has(linked)) anchorCache.set(linked, anchorsOf(texts.get(linked) ?? readFileSync(linked, 'utf8')));
      if (!anchorCache.get(linked).has(decodeURIComponent(anchor).toLowerCase())) problems.push(`${where(number)} : ancre introuvable ${target}`);
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problème(s) dans docs/.`);
  process.exit(1);
}
console.log(`docs/ : ${files.length} pages, aucune référence au plan, liens et ancres valides.`);
