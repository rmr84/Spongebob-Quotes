#!/usr/bin/env node
/**
 * Builds public/quotes.json from the classic seasons.
 *
 * Only well-known lines are kept. They come from two lists:
 *   - scripts/iconic-quotes.json, a hand-picked list
 *   - the quoted headings on the fan wiki's "List of memes" page
 *
 * Every candidate is matched against the episode transcripts on the SpongeBob
 * fan wiki (spongebob.fandom.com, CC BY-SA), so the text shown in the game is
 * the real line, with the real speaker, episode and season. Candidates that
 * aren't found in the classic seasons are skipped and reported.
 *
 * Usage:
 *   npm run fetch-quotes                 # build (uses cached downloads if present)
 *   npm run fetch-quotes -- --refresh    # re-download everything
 *   npm run fetch-quotes -- --find "your genius"   # search transcript lines
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SEASONS = [1, 2, 3, 4, 5]; // "classic" era
const FANDOM = 'https://spongebob.fandom.com/api.php';
const UA = 'spongebob-quote-game-builder/1.0 (personal fan project)';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, 'scripts', '.cache', 'raw.json');
const OUT = path.join(ROOT, 'src', 'data', 'quotes.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const readJson = async (p) => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));
const { SPEAKER_ALIASES } = await readJson('scripts/speakers.json');
const ICONIC = await readJson('scripts/iconic-quotes.json');

const aliasMap = new Map();
for (const [id, names] of Object.entries(SPEAKER_ALIASES)) for (const n of names) aliasMap.set(n.toLowerCase(), id);

// ---------------------------------------------------------------- download

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

async function categoryMembers(category) {
  const titles = [];
  let cont;
  do {
    const data = await api(FANDOM, {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '500',
      cmnamespace: '0',
      ...(cont ? { cmcontinue: cont } : {}),
    });
    titles.push(...data.query.categorymembers.map((m) => m.title));
    cont = data.continue?.cmcontinue;
  } while (cont);
  return titles;
}

async function fetchWikitext(base, titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await api(base, {
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: batch.join('|'),
    });
    const back = new Map();
    for (const n of data.query.normalized ?? []) back.set(n.to, n.from);
    for (const r of data.query.redirects ?? []) back.set(r.to, back.get(r.from) ?? r.from);
    for (const page of data.query.pages) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      if (text) out[back.get(page.title) ?? page.title] = text;
    }
    await sleep(300);
  }
  return out;
}

async function download() {
  const episodes = [];
  for (const s of SEASONS) {
    const titles = (await categoryMembers(`Season ${s} episodes`)).sort();
    console.log(`Season ${s}: ${titles.length} episodes`);
    for (const t of titles) episodes.push({ t, s });
  }
  const transcripts = await fetchWikitext(FANDOM, episodes.map((e) => `${e.t}/transcript`));
  const { 'List of memes': memes } = await fetchWikitext(FANDOM, ['List of memes']);
  const raw = { episodes, transcripts, memes };
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(raw));
  return raw;
}

// ---------------------------------------------------------------- parsing

/** Strip wiki markup from a line of dialogue. */
function clean(raw) {
  let s = raw;
  s = s.replace(/<ref[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<[^>]+>/g, '');
  for (let i = 0; i < 3; i++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = s.replace(/''\s*\[[^\]]*\]\s*''/g, ' ');
  s = s.replace(/\[(?!\[)[^\]]*\]/g, ' ');
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
  s = s.replace(/'{2,}/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[,.\s]+/, '').replace(/\s+([,.!?])/g, '$1');
  s = s.replace(/\.{4,}/g, '...');
  return s;
}

function speakerId(label) {
  const base = label
    .replace(/\([^)]*\)/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .trim()
    .toLowerCase();
  return aliasMap.get(base) ?? null;
}

const LINE_RE = /^\{\{L\|([^|{}]+)\|([\s\S]*)\}\}\s*$/;

/** Every line of dialogue in the downloaded transcripts. */
function parseLines(raw) {
  const lines = [];
  raw.episodes.forEach((ep, epIndex) => {
    const wikitext = raw.transcripts[`${ep.t}/transcript`];
    if (!wikitext) return console.warn(`  (no transcript for ${ep.t})`);
    for (const rawLine of wikitext.split('\n')) {
      for (const piece of rawLine.split(/(?=\{\{L\|)/)) {
        const m = piece.replace(/<\/?font[^>]*>/g, '').trim().match(LINE_RE);
        if (!m) continue;
        const text = clean(m[2]);
        if (!text || !/[a-z]/i.test(text)) continue;
        lines.push({ label: m[1].trim(), c: speakerId(m[1]), text, ep: epIndex });
      }
    }
  });
  return lines;
}

// ---------------------------------------------------------------- matching

const tokens = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

function f1(a, b) {
  const counts = new Map();
  for (const t of b) counts.set(t, (counts.get(t) ?? 0) + 1);
  let common = 0;
  for (const t of a) {
    const n = counts.get(t);
    if (n) {
      common++;
      counts.set(t, n - 1);
    }
  }
  if (!common) return 0;
  const p = common / b.length;
  const r = common / a.length;
  return (2 * p * r) / (p + r);
}

const sentences = (text) => text.match(/[^.!?…♪]+[.!?…♪]*["”]?\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

/**
 * Finds the transcript line that best matches `query` and returns the
 * contiguous run of its sentences that matches best, so a long speech can be
 * trimmed down to the famous part.
 */
function bestMatch(lines, query, characterId) {
  const q = tokens(query);
  let best = null;
  for (const line of lines) {
    if (characterId && line.c !== characterId) continue;
    if (!line.c) continue;
    const sents = sentences(line.text);
    for (let i = 0; i < sents.length; i++) {
      for (let j = i; j < Math.min(sents.length, i + 6); j++) {
        const text = sents.slice(i, j + 1).join(' ');
        const score = f1(q, tokens(text));
        if (!best || score > best.score + 1e-9) best = { line, text, score };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------- build

/**
 * Lines quoted on "List of memes": section headings like ===="How tough are ya?"====
 * and lines quoted in the descriptions ("Once there was an ugly barnacle…").
 */
function memeQuotes(wikitext) {
  const out = new Set();
  for (const m of wikitext.matchAll(/^={3,5}\s*"([^"=]+)"\s*={3,5}\s*$/gm)) {
    const q = clean(m[1]);
    if (tokens(q).length >= 4) out.add(q);
  }
  for (const line of wikitext.split('\n')) {
    if (/^(=|\[\[File|\{\{|<gallery|\|)/.test(line)) continue;
    for (const m of line.matchAll(/["“]([^"”]{12,220})["”]/g)) {
      const q = clean(m[1]);
      if (tokens(q).length >= 6 && !/\[\[|\]\]/.test(m[1])) out.add(q);
    }
  }
  return [...out];
}

const capitalize = (s) => s.replace(/^([^a-z]*)([a-z])/i, (_, pre, ch) => pre + ch.toUpperCase());

const norm = (s) => tokens(s).join(' ');

async function main() {
  const raw = !flag('--refresh') && existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf8')) : await download();
  const lines = parseLines(raw);
  const epName = (i) => `${raw.episodes[i].t} (S${raw.episodes[i].s})`;

  const find = option('--find');
  if (find) {
    const needle = norm(find);
    for (const l of lines) if (norm(l.text).includes(needle)) console.log(`${l.label} [${l.c ?? '-'}] | ${epName(l.ep)} | ${l.text}`);
    return;
  }

  // First season each roster character speaks in.
  const debut = {};
  for (const l of lines) if (l.c) debut[l.c] = Math.min(debut[l.c] ?? Infinity, raw.episodes[l.ep].s);

  const quotes = [];
  const seen = new Set();
  const add = (text, c, ep) => {
    const key = norm(text);
    // Skip exact repeats and lines that are just a piece of one we already have (or vice versa).
    for (const k of seen) if (k.includes(key) || key.includes(k)) return false;
    seen.add(key);
    quotes.push([capitalize(text), c, ep]);
    return true;
  };

  // Tier 1: iconic.
  const misses = [];
  const candidates = [...ICONIC.map((e) => ({ ...e, min: 0.7 })), ...memeQuotes(raw.memes ?? '').map((q) => ({ q, min: 0.95, meme: true }))];
  for (const entry of candidates) {
    // `show` pins the exact excerpt to display; it must appear verbatim in a line by that speaker.
    if (entry.show) {
      const line = lines.find((l) => l.c && (!entry.c || l.c === entry.c) && norm(l.text).includes(norm(entry.show)));
      if (line) add(entry.show, line.c, line.ep);
      else misses.push(`${entry.c ?? '?'}: "${entry.show}"  (excerpt not found)`);
      continue;
    }
    const m = bestMatch(lines, entry.q, entry.c);
    if (!m || m.score < entry.min) {
      if (entry.meme) continue; // most memes are from later seasons
      misses.push(`${entry.c ?? '?'}: "${entry.q}"  (best ${m ? m.score.toFixed(2) : 0}: ${m ? `${m.line.c} "${m.text}"` : '-'})`);
      continue;
    }
    if (flag('--verbose') || m.score < 0.85)
      console.log(`  ${m.score.toFixed(2)} ${m.line.c.padEnd(11)} ${epName(m.line.ep).padEnd(34)} ${m.text}`);
    add(m.text, m.line.c, m.line.ep);
  }
  // Only ship episodes that are referenced, and re-index.
  const used = [...new Set(quotes.map((q) => q[2]))].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  const out = {
    seasons: SEASONS,
    episodes: used.map((i) => raw.episodes[i]),
    debut,
    quotes: quotes.map(([t, c, ep]) => [t, c, remap.get(ep)]),
  };
  await writeFile(OUT, JSON.stringify(out));

  const counts = {};
  for (const [, c] of quotes) counts[c] = (counts[c] ?? 0) + 1;
  console.log(`\n${quotes.length} quotes -> ${path.relative(ROOT, OUT)}`);
  console.table(Object.entries(counts).sort((a, b) => b[1] - a[1]));
  if (misses.length) {
    console.log(`\n${misses.length} iconic quotes not found in seasons ${SEASONS.join(', ')}:`);
    for (const m of misses) console.log('  ' + m);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
