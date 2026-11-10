#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT || 4179);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let file = path.normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
  if (!file || file.endsWith('/')) file += 'index.html';
  const full = path.join(root, file);
  if (!full.startsWith(root) || !existsSync(full) || statSync(full).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(full);
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  res.end(await readFile(full));
});

server.listen(port, '127.0.0.1', () => {
  console.log('http://127.0.0.1:' + port);
});
