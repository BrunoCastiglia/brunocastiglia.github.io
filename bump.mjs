/* ==========================================================================
   Sobe a versão dos arquivos estáticos — `npm run bump`
   --------------------------------------------------------------------------
   O index.html fura o cache do navegador com `?v=NN` no CSS e no app.js. Isso
   sozinho não basta, e a falha é traiçoeira: os módulos que o app.js importa
   (engine.js, providers/ryanair.js…) não passam pelo HTML, então o navegador
   continuava servindo os antigos do cache. Subir só o número do app.js
   montava um par incompatível — código novo chamando um módulo velho — e o
   site quebrava até o cache do GitHub Pages expirar, dez minutos depois.

   Este script sobe o número em TODOS os lugares de uma vez: o HTML e cada
   import relativo. Ou tudo é novo, ou tudo é antigo.
   ======================================================================== */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));

/** Todos os arquivos com uma extensão, descendo pelas pastas. */
function achar(pasta, ext, achados = []) {
  for (const nome of readdirSync(pasta)) {
    if (nome === '.git' || nome === 'node_modules') continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) achar(caminho, ext, achados);
    else if (nome.endsWith(ext)) achados.push(caminho);
  }
  return achados;
}

const htmls = achar(raiz, '.html');
const jss = achar(join(raiz, 'assets', 'js'), '.js');

// A versão atual é a que está no index.html; a nova é a seguinte.
const index = readFileSync(join(raiz, 'index.html'), 'utf8');
const atual = Number(index.match(/\?v=(\d+)/)?.[1] ?? 0);
const nova = Number(process.argv[2]) || atual + 1;
if (!atual) throw new Error('não achei ?v=NN no index.html');

let tocados = 0;

// 1. o HTML: <link> e <script>
for (const arquivo of htmls) {
  const antes = readFileSync(arquivo, 'utf8');
  const depois = antes.replace(/\?v=\d+/g, `?v=${nova}`);
  if (depois !== antes) { writeFileSync(arquivo, depois); tocados++; }
}

// 2. cada import relativo dentro do JS, com ou sem versão já colada
for (const arquivo of jss) {
  const antes = readFileSync(arquivo, 'utf8');
  const depois = antes.replace(
    /(from\s+'(?:\.\.?\/)[^']*?\.js)(\?v=\d+)?'/g,
    (_, caminho) => `${caminho}?v=${nova}'`,
  );
  if (depois !== antes) { writeFileSync(arquivo, depois); tocados++; }
}

console.log(`v${atual} → v${nova} · ${tocados} arquivos atualizados`);
