#!/usr/bin/env node
// Checks the JSON that the build writes to dist/ (run after `npm run build`).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactPath, rings, simplifyRing } from '../scripts/compact-path.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

async function load(name) {
  const text = await readFile(path.join(dist, name), 'utf8');
  if (/\n\s/.test(text)) throw new Error(name + ' should be written without indentation');
  return { text, data: JSON.parse(text) };
}

const map = await load('map.json');
const regions = await load('kuni-regions.json');
const provinces = await load('provinces.json');
const source = JSON.parse(await readFile(path.join(root, 'data/kuni-regions.json'), 'utf8'));
const sourceMap = JSON.parse(await readFile(path.join(root, 'data/map.json'), 'utf8'));

// The compact outline must have exactly the vertices of the data/ outline
// (same 0.1 grid), only without repeated points and the duplicate closing point.
function sameOutline(compact, original) {
  const a = rings(compact);
  const b = rings(original).map(simplifyRing);
  return JSON.stringify(a) === JSON.stringify(b);
}

if (compactPath('M1.0,2.0L1.0,2.0L1.5,2.0L0.5,-0.3L1.0,2.0ZM10.0,0.0L10.0,1.0Z') !== 'M1 2l.5 0-1-2.3zM10 0l0 1z') {
  throw new Error('compactPath self-test failed');
}
if (Object.keys(map.data.paths).length !== Object.keys(sourceMap.paths).length) {
  throw new Error('map.json: path count changed in dist');
}
for (const [id, rec] of Object.entries(map.data.paths)) {
  if (!/^M[^LZ]*z$/.test(rec.d)) throw new Error('map.json/' + id + ' is not in the compact form');
  if (!sameOutline(rec.d, sourceMap.paths[id].d)) throw new Error('map.json/' + id + ' outline differs from data/');
}

for (const group of ['kuni', 'outside']) {
  const built = regions.data[group] || {};
  const orig = source[group] || {};
  if (Object.keys(built).length !== Object.keys(orig).length) {
    throw new Error(group + ': region count changed in dist');
  }
  for (const [id, rec] of Object.entries(built)) {
    const d = rec.d || (map.data.paths[id] && map.data.paths[id].d);
    if (!d) throw new Error(group + '/' + id + ' has no outline in dist');
    if (!sameOutline(d, orig[id].d)) throw new Error(group + '/' + id + ' outline differs from data/');
    if (rec.d && map.data.paths[id] && sameOutline(rec.d, sourceMap.paths[id].d)) {
      throw new Error(group + '/' + id + ' outline is duplicated in kuni-regions.json');
    }
    for (const k of ['cx', 'cy', 'bbox', 'area', 'ja']) {
      if (rec[k] === undefined) throw new Error(group + '/' + id + ' lost ' + k);
    }
  }
}

const total = [map, regions, provinces].reduce((n, f) => n + Buffer.byteLength(f.text), 0);
const budget = 260 * 1024;
if (total > budget) {
  throw new Error('dist JSON is ' + total + ' bytes, over the ' + budget + ' byte budget');
}
console.log('dist-check ok: compact JSON and outlines, no duplicated outlines, ' + Math.round(total / 1024) + ' KB total');
