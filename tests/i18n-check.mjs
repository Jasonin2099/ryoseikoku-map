#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = await readFile(path.join(root, 'src/app.js'), 'utf8');
const html = await readFile(path.join(root, 'src/index.html'), 'utf8');

const block = src.match(/var STR = \{([\s\S]*?)\n  \};/);
if (!block) throw new Error('could not find STR in app.js');

function keysOf(lang) {
  const re = new RegExp(lang + ':\\s*\\{([\\s\\S]*?)\\s*\\}[\\s,]*\\n\\s*(?:zh|ja|var |function )', 'm');
  // Simpler: take ja: { ... }, zh: { ... } by scanning identifiers before : 
  const startTag = lang + ':';
  const start = block[1].indexOf(startTag);
  if (start < 0) throw new Error('missing STR.' + lang);
  const open = block[1].indexOf('{', start);
  let depth = 0;
  for (let i = open; i < block[1].length; i++) {
    const ch = block[1][i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return block[1].slice(open + 1, i);
      }
    }
  }
  throw new Error('unclosed STR.' + lang);
}

function parseKeys(body) {
  const keys = [];
  const re = /(?:^|,)\s*([A-Za-z][A-Za-z0-9]*)\s*:/g;
  let m;
  while ((m = re.exec(body))) keys.push(m[1]);
  return keys;
}

const jaKeys = parseKeys(keysOf('ja'));
const zhKeys = parseKeys(keysOf('zh'));
const jaSet = new Set(jaKeys);
const zhSet = new Set(zhKeys);
const missingZh = jaKeys.filter((k) => !zhSet.has(k));
const missingJa = zhKeys.filter((k) => !jaSet.has(k));
if (missingZh.length) throw new Error('zh missing STR keys: ' + missingZh.join(', '));
if (missingJa.length) throw new Error('ja missing STR keys: ' + missingJa.join(', '));

const used = new Set();
for (const re of [
  /\bT\('([A-Za-z][A-Za-z0-9]*)'\)/g,
  /\bT\("([A-Za-z][A-Za-z0-9]*)"\)/g,
]) {
  let m;
  while ((m = re.exec(src))) used.add(m[1]);
}
const missingUsed = [...used].filter((k) => !jaSet.has(k)).sort();
if (missingUsed.length) throw new Error('T() keys missing from STR: ' + missingUsed.join(', '));

// shareText must exist in both (it is a function, still a key)
if (!jaSet.has('shareText') || !zhSet.has('shareText')) {
  throw new Error('shareText must exist in both languages');
}

if (!html.includes('lang="ja"')) {
  throw new Error('index.html should default to lang=ja');
}

console.log('i18n-check ok: ' + jaKeys.length + ' STR keys in ja and zh, ' + used.size + ' T() uses');
