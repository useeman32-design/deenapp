/* Tiny static server that behaves like GitHub Pages: unknown paths → 404.html
 * (which is our SPA), correct MIME for .txt/.ttf/.mp4/.mjs. Usage: node pages-server.mjs <dir> <port> */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const root = process.argv[2] ?? 'dist/deenapp';
const port = +(process.argv[3] ?? 3996);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.map': 'application/json',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const prefix = `/${root.split('/').pop()}`; // e.g. /deenapp
    if (p.startsWith(prefix)) p = p.slice(prefix.length) || '/';
    if (p.endsWith('/')) p += 'index.html';
    let file = join(root, p);
    let body;
    try { body = await readFile(file); } catch {
      body = await readFile(join(root, '404.html'));
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(body);
    }
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(port, '0.0.0.0', () => console.log(`pages-server on :${port} serving ${root}`));
