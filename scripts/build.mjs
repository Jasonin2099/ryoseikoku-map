#!/usr/bin/env node
import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify as minifyJs } from 'terser';
import CleanCSS from 'clean-css';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const sitePath = arg('--site');
const site = sitePath
  ? JSON.parse(await readFile(path.resolve(sitePath), 'utf8'))
  : null;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

function runPython(script) {
  const r = spawnSync('python3', [path.join(root, script)], {
    stdio: 'inherit',
    env: { ...process.env },
    cwd: root,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

runPython('scripts/subset-font.py');

async function assetVersion() {
  const git = spawnSync('git', ['-C', root, 'rev-parse', '--short=7', 'HEAD'], {
    encoding: 'utf8',
  });
  const dirty = spawnSync('git', ['-C', root, 'status', '--porcelain'], {
    encoding: 'utf8',
  });
  if (git.status === 0 && dirty.status === 0 && dirty.stdout.trim() === '') {
    const hash = git.stdout.trim();
    if (/^[0-9a-f]+$/.test(hash)) return hash;
  }
  const parts = [
    'src/app.js',
    'src/style.css',
    'src/index.html',
    'data/map.json',
    'data/provinces.json',
    'data/kuni-regions.json',
  ];
  const hash = createHash('sha256');
  for (const rel of parts) {
    hash.update(rel);
    hash.update(await readFile(path.join(root, rel)));
  }
  return hash.digest('hex').slice(0, 7);
}

const version = await assetVersion();

let jsSrc = await readFile(path.join(root, 'src/app.js'), 'utf8');
jsSrc = jsSrc.replaceAll('__ASSET_VERSION__', version);
const jsMin = await minifyJs(jsSrc, {
  compress: true,
  mangle: true,
  format: { comments: false },
});
if (jsMin.error) throw jsMin.error;
await writeFile(path.join(dist, 'app.min.js'), jsMin.code);

let cssSrc = await readFile(path.join(root, 'src/style.css'), 'utf8');
cssSrc = cssSrc.replaceAll('jinghua-sub.woff2', `jinghua-sub.woff2?v=${version}`);
const cssMin = new CleanCSS({ level: 2 }).minify(cssSrc);
if (cssMin.errors.length) throw new Error(cssMin.errors.join('\n'));
await writeFile(path.join(dist, 'style.min.css'), cssMin.styles);

let html = await readFile(path.join(root, 'src/index.html'), 'utf8');
html = html
  .replace('href="style.css"', `href="style.min.css?v=${version}"`)
  .replace('src="app.js"', `src="app.min.js?v=${version}"`)
  .replace('href="jinghua-sub.woff2"', `href="jinghua-sub.woff2?v=${version}"`);

if (site) {
  const canon = site.canonical ? site.canonical.replace(/\/?$/, '/') : '';
  if (canon) {
    const tags = [
      `<link rel="canonical" href="${canon}">`,
      `<link rel="alternate" hreflang="ja" href="${canon}">`,
      `<meta property="og:url" content="${canon}">`,
    ];
    if (site.ogImage) {
      tags.push(`<meta property="og:image" content="${site.ogImage}">`);
      tags.push(`<meta name="twitter:image" content="${site.ogImage}">`);
    }
    html = html.replace('</title>', `</title>\n${tags.join('\n')}`);
  }
  if (site.extraBody) {
    html = html.replace('</body>', `${site.extraBody}\n</body>`);
  }
  if (Array.isArray(site.extraScripts)) {
    const scripts = site.extraScripts
      .map((src) => `<script src="${src}" defer></script>`)
      .join('\n');
    html = html.replace('</body>', `${scripts}\n</body>`);
  }
}

await writeFile(path.join(dist, 'index.html'), html);

async function copyTo(src, destName) {
  await cp(src, path.join(dist, destName));
}

await copyTo(path.join(root, 'data/map.json'), 'map.json');
await copyTo(path.join(root, 'data/provinces.json'), 'provinces.json');
await copyTo(path.join(root, 'data/kuni-regions.json'), 'kuni-regions.json');
await copyTo(path.join(root, 'assets/icon.svg'), 'icon.svg');
await copyTo(path.join(root, 'assets/icon-32.png'), 'icon-32.png');
await copyTo(path.join(root, 'assets/apple-touch-icon.png'), 'apple-touch-icon.png');

const ogSrc = site?.ogImageFile
  ? path.resolve(site.ogImageFile)
  : path.join(root, 'assets/og.png');
if (existsSync(ogSrc)) await copyTo(ogSrc, 'og.png');

console.log('built', dist, 'v=' + version);
