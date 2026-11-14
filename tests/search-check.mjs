#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = await readFile(path.join(root, 'src/app.js'), 'utf8');
const provinces = JSON.parse(await readFile(path.join(root, 'data/provinces.json'), 'utf8'));

const foldBlock = src.match(/var CJK_FOLD = \{[\s\S]*?\};/);
const normBlock = src.match(/function normalize\(s\)\{[\s\S]*?\n  \}/);
if (!foldBlock || !normBlock) throw new Error('could not extract CJK_FOLD / normalize from app.js');

const context = { String };
vm.createContext(context);
vm.runInContext(foldBlock[0] + '\n' + normBlock[0] + '\nthis.normalize = normalize;\nthis.CJK_FOLD = CJK_FOLD;', context);
const normalize = context.normalize;

function haystack(p) {
  const dao = provinces.dao[p.dao] || {};
  const g = provinces.grade[p.grade] || {};
  const d = provinces.distance[p.distance] || {};
  const kf = p.kokufu || {};
  const parts = [p.ja, p.kana, p.romaji, p.id, p.dao, dao.ja, dao.kana]
    .concat(p.pref || [])
    .concat([g.ja, g.zh, g.kana, d.ja, d.zh, d.kana, kf.gun, kf.wamyo, kf.jikaisho, kf.iroha]);
  for (const s of p.ichinomiya || []) {
    parts.push(s.ja, s.kana);
    if (s.alias && s.alias.length) parts.push(...s.alias);
  }
  if (p.ichinomiya_disputed) parts.push('諸説', '诸说', '諸説あり');
  return normalize(parts.filter(Boolean).join(' '));
}

function idsFor(q) {
  const nq = normalize(q);
  return provinces.provinces.filter((p) => haystack(p).indexOf(nq) >= 0).map((p) => p.id);
}

function outsideNames(id) {
  if (id === 'hokkaido') {
    return ['北海道', 'ほっかいどう', 'hokkaido', '蝦夷地', 'えぞち', 'えぞ', 'ezo', 'ezochi'];
  }
  return ['琉球', 'りゅうきゅう', 'ryukyu', '沖縄', 'おきなわ', 'okinawa', '冲绳', '琉球王国'];
}

const cases = [
  ['やましろ', ['yamashiro']],
  ['山陽道', ['harima', 'aki', 'nagato']],
  ['山阳道', ['harima', 'aki', 'nagato']],
  ['鹿島', ['hitachi']],
  ['下総', ['shimosa']],
  ['下总', ['shimosa']],
];
for (const [q, need] of cases) {
  const got = idsFor(q);
  for (const id of need) {
    if (!got.includes(id)) throw new Error('query ' + q + ' missed ' + id + ' (got ' + got.join(',') + ')');
  }
}

for (const [q, id] of [['蝦夷地', 'hokkaido'], ['えぞち', 'hokkaido'], ['冲绳', 'ryukyu'], ['沖縄', 'ryukyu']]) {
  if (normalize(outsideNames(id).join(' ')).indexOf(normalize(q)) < 0) {
    throw new Error('outside query ' + q + ' missed ' + id);
  }
}

if (idsFor('存在しない国名xyz').length) throw new Error('nonsense query should miss');
if (!normalize('山阳道').includes('陽')) throw new Error('CJK fold should map 阳 → 陽');

console.log('search-check ok: dao names, CJK variants, kana, ichinomiya, Hokkaido/Ryukyu');
