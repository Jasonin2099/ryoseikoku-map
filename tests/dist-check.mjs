#!/usr/bin/env node
// Checks the JSON that the build writes to dist/ (run after `npm run build`).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

for (const group of ['kuni', 'outside']) {
  const built = regions.data[group] || {};
  const orig = source[group] || {};
  if (Object.keys(built).length !== Object.keys(orig).length) {
    throw new Error(group + ': region count changed in dist');
  }
  for (const [id, rec] of Object.entries(built)) {
    const d = rec.d || (map.data.paths[id] && map.data.paths[id].d);
    if (!d) throw new Error(group + '/' + id + ' has no outline in dist');
    if (d !== orig[id].d) throw new Error(group + '/' + id + ' outline differs from data/');
    if (rec.d && map.data.paths[id] && map.data.paths[id].d === rec.d) {
      throw new Error(group + '/' + id + ' outline is duplicated in kuni-regions.json');
    }
    for (const k of ['cx', 'cy', 'bbox', 'area', 'ja']) {
      if (rec[k] === undefined) throw new Error(group + '/' + id + ' lost ' + k);
    }
  }
}

const total = [map, regions, provinces].reduce((n, f) => n + Buffer.byteLength(f.text), 0);
const budget = 450 * 1024;
if (total > budget) {
  throw new Error('dist JSON is ' + total + ' bytes, over the ' + budget + ' byte budget');
}
console.log('dist-check ok: compact JSON, no duplicated outlines, ' + Math.round(total / 1024) + ' KB total');
