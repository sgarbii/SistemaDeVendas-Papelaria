// Gera js/vendor/supabase-js.js: uma cópia local do supabase-js em um único
// arquivo ESM. Assim o site não depende de CDN (CSP com script-src 'self').
// Também copia as fontes para fonts/.
//
// Uso (só quando for trocar a versão): npm run vendor
// A versão vem fixa do package.json (sem "^"), nunca "latest".
import { build } from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const versao = JSON.parse(readFileSync('node_modules/@supabase/supabase-js/package.json', 'utf8')).version;
const destino = 'js/vendor/supabase-js.js';

const resultado = await build({
  stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: '.' },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'inline',
  write: false,
});

const cabecalho = `/*! supabase-js ${versao} (licença MIT) — https://github.com/supabase/supabase-js
 *  Origem: pacote npm @supabase/supabase-js@${versao}, empacotado com esbuild
 *  por scripts/gerar-vendor.mjs. Não edite este arquivo à mão. */\n`;
const codigo = cabecalho + resultado.outputFiles[0].text;
writeFileSync(destino, codigo);

const hash = createHash('sha384').update(codigo).digest('base64');
console.log(`${destino} gerado (supabase-js ${versao}, ${(codigo.length / 1024).toFixed(0)} KB)`);
console.log(`sha384-${hash}`);

// Fontes locais (licença OFL), em vez do Google Fonts: o site não faz
// requisições a terceiros e a CSP pode usar style-src 'self'.
const fontes = [
  ['young-serif', 'young-serif-latin-400-normal.woff2'],
  ['atkinson-hyperlegible', 'atkinson-hyperlegible-latin-400-normal.woff2'],
  ['atkinson-hyperlegible', 'atkinson-hyperlegible-latin-700-normal.woff2'],
];
mkdirSync('fonts', { recursive: true });
for (const [pacote, arquivo] of fontes) {
  copyFileSync(`node_modules/@fontsource/${pacote}/files/${arquivo}`, `fonts/${arquivo}`);
}
copyFileSync('node_modules/@fontsource/young-serif/LICENSE', 'fonts/LICENCA-young-serif.txt');
copyFileSync('node_modules/@fontsource/atkinson-hyperlegible/LICENSE', 'fonts/LICENCA-atkinson-hyperlegible.txt');
console.log('fontes copiadas para fonts/');
