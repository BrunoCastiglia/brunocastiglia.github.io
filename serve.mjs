/* Servidor estático mínimo para desenvolvimento: node serve.mjs [porta] */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = import.meta.dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon',
};

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, rel));
    // 'no-store' e não 'no-cache': sem ETag, o navegador segurava a versão
    // antiga dos módulos ES e o site rodava código já corrigido no disco.
    res.writeHead(200, {
      'Content-Type': TYPES[extname(rel)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
