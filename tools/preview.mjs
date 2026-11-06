// Local preview of hunteracedev.com as GitHub Pages will serve it.
//
//   ..\tin-hats\x.cmd node tools\preview.mjs        (from this folder; the game's wrapper provides Node)
//
// Serves this folder at http://localhost:8080/ and the built Tin Hats game (the sibling folder ../tin-hats/dist, or
// TIN_HATS_DIST) at /tin-hats/, exactly where the live site puts them. Other games that live in their own repos (/bulwark/, /magic-academy/) are not
// here, so those links are passed through to the live site. Plain Node, no packages. Ctrl+C stops it.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(fileURLToPath(import.meta.url), '..', '..');
const MOUNTS = [
  { prefix: '/tin-hats/', root: process.env.TIN_HATS_DIST ?? resolve(SITE, '..', 'tin-hats', 'dist') },
  { prefix: '/', root: SITE },
];
const PASS_THROUGH = ['/bulwark/', '/magic-academy/'];
const PORT = Number(process.env.PORT ?? 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (PASS_THROUGH.some((p) => path.startsWith(p))) {
    res.writeHead(302, { Location: `https://hunteracedev.com${path}` });
    res.end();
    return;
  }
  // GitHub Pages redirects a folder address without its trailing slash; do the same for the mounted games.
  if (MOUNTS.some((m) => m.prefix !== '/' && `${path}/` === m.prefix)) {
    res.writeHead(301, { Location: `${path}/${url.search}` });
    res.end();
    return;
  }
  const mount = MOUNTS.find((m) => path.startsWith(m.prefix));
  if (!mount) return send(res, 404, 'not found');
  if (path.endsWith('/')) path += 'index.html';
  const rel = normalize(path.slice(mount.prefix.length)).replace(/^([.][.][\\/])+/, '');
  const file = join(mount.root, rel);
  if (!file.startsWith(resolve(mount.root)) || !existsSync(file) || !statSync(file).isFile()) {
    // GitHub Pages serves a folder's index.html when the URL has no trailing slash; mirror that with a redirect.
    if (!extname(path) && existsSync(join(mount.root, rel, 'index.html'))) {
      res.writeHead(301, { Location: `${path}/` });
      res.end();
      return;
    }
    return send(res, 404, `not found: ${path}`);
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`hunteracedev preview: http://localhost:${PORT}/   (Tin Hats at /tin-hats/ from ${MOUNTS[0].root})`);
});
