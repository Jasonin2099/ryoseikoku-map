#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const provinces = JSON.parse(await readFile(path.join(root, 'data/provinces.json'), 'utf8'));
const map = JSON.parse(await readFile(path.join(root, 'data/map.json'), 'utf8'));

const list = provinces.provinces;
if (list.length !== 68) throw new Error('expected 68 provinces, got ' + list.length);

const counts = { grade: {}, distance: {} };
const ids = new Set();
for (const p of list) {
  for (const k of ['id', 'ja', 'kana', 'romaji', 'dao', 'pref', 'origin', 'origin_ja', 'ref', 'ref_ja', 'grade', 'distance', 'kokufu', 'ichinomiya']) {
    if (p[k] === undefined) throw new Error(p.id + ' missing ' + k);
  }
  if (ids.has(p.id)) throw new Error('duplicate id ' + p.id);
  ids.add(p.id);
  counts.grade[p.grade] = (counts.grade[p.grade] || 0) + 1;
  counts.distance[p.distance] = (counts.distance[p.distance] || 0) + 1;
  if (!provinces.grade[p.grade]) throw new Error('unknown grade ' + p.grade);
  if (!provinces.distance[p.distance]) throw new Error('unknown distance ' + p.distance);
  if (!provinces.dao[p.dao]) throw new Error('unknown dao ' + p.dao);
  if (!Array.isArray(p.ichinomiya) || !p.ichinomiya.length) throw new Error(p.id + ' missing ichinomiya');
  for (const s of p.ichinomiya) {
    if (!s || !s.ja || !s.kana) throw new Error(p.id + ' ichinomiya needs ja and kana');
  }
  const disputed = !!p.ichinomiya_disputed;
  if (disputed !== (p.ichinomiya.length > 1)) {
    throw new Error(p.id + ' ichinomiya_disputed should match multiple candidates');
  }
  const banned = ['北海道神宮', '岩木山神社', '駒形神社', '伊佐須美神社', '波上宮', '秩父神社'];
  for (const s of p.ichinomiya) {
    if (banned.includes(s.ja)) throw new Error(p.id + ' must not use 新一の宮 ' + s.ja);
  }
}


const expectGrade = { taikoku: 13, jokoku: 35, chukoku: 11, gekoku: 9 };
const expectDist = { kinai: 5, kingoku: 17, chugoku: 16, ongoku: 30 };
for (const [k, v] of Object.entries(expectGrade)) {
  if (counts.grade[k] !== v) throw new Error('grade ' + k + ' ' + counts.grade[k]);
}
for (const [k, v] of Object.entries(expectDist)) {
  if (counts.distance[k] !== v) throw new Error('distance ' + k + ' ' + counts.distance[k]);
}

const paths = map.paths;
const pathIds = Object.keys(paths);
if (pathIds.length !== 70) throw new Error('expected 70 paths (68 kuni + hokkaido + ryukyu), got ' + pathIds.length);
if (!paths.hokkaido || !paths.ryukyu) throw new Error('map missing hokkaido or ryukyu');
if (map.width !== 1100) throw new Error('unexpected map width ' + map.width);
for (const id of ids) {
  const info = paths[id];
  if (!info) throw new Error('province not on map: ' + id);
  if (!info.d || info.d.length < 8) throw new Error('empty path for ' + id);
  if (info.kind && info.kind !== 'kuni') throw new Error(id + ' should be kind kuni');
  if (info.dao && !provinces.dao[info.dao]) throw new Error(id + ' unknown dao ' + info.dao);
}
for (const id of pathIds) {
  if (id === 'hokkaido' || id === 'ryukyu') continue;
  if (!ids.has(id)) throw new Error('map id missing from provinces: ' + id);
}
if ((await stat(path.join(root, 'data/map.json'))).size > 600 * 1024) {
  throw new Error('map.json is larger than 600KB');
}

console.log('data-check ok: 68 provinces, grade/distance/ichinomiya, 70 map paths');

const regions = JSON.parse(await readFile(path.join(root, 'data/kuni-regions.json'), 'utf8'));
if (!regions.kuni) throw new Error('kuni-regions missing kuni');
for (const id of ids) {
  const rec = regions.kuni[id];
  if (!rec) throw new Error('kuni-regions missing ' + id);
  if (!rec.d || rec.d.length < 8) throw new Error('kuni-regions empty path ' + id);
  if (!rec.bbox || rec.bbox.length !== 4) throw new Error('kuni-regions bbox ' + id);
}
for (const id of Object.keys(regions.kuni)) {
  if (!ids.has(id)) throw new Error('kuni-regions extra id ' + id);
}
if (!regions.outside || !regions.outside.hokkaido || !regions.outside.ryukyu) {
  throw new Error('kuni-regions missing outside groups');
}
console.log('data-check ok: kuni-regions covers 68 provinces');
