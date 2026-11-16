// Build do Netlify (ver netlify.toml): confere a configuração e copia
// só os arquivos do site para a pasta "publicar".
import { readFileSync, rmSync, mkdirSync, cpSync, readdirSync } from 'node:fs';

function falhar(mensagem) {
  console.error(`\n[preparar-deploy] ERRO: ${mensagem}\n`);
  process.exit(1);
}

// 1) js/config.js preenchido?
const config = readFileSync('js/config.js', 'utf8');
const url = config.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1] ?? '';
if (url.includes('SEU-PROJETO') || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  falhar('preencha SUPABASE_URL em js/config.js com a URL do seu projeto (https://xxxx.supabase.co).');
}
if (config.includes('COLE-AQUI')) {
  falhar('preencha SUPABASE_CHAVE_PUBLICA em js/config.js com a chave anon/publishable.');
}

// 2) a CSP do netlify.toml libera o mesmo projeto?
const toml = readFileSync('netlify.toml', 'utf8');
const csp = toml.match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? '';
const realtime = url.replace('https://', 'wss://');
const cspOk = csp.includes(`connect-src 'self' ${url} ${realtime}`) && csp.includes(`img-src 'self' data: ${url}`);
if (!cspOk) {
  falhar(`a Content-Security-Policy do netlify.toml precisa usar ${url} (e ${realtime}) em connect-src, e ${url} em img-src.`);
}

// 3) copia só o site
const ARQUIVOS_DO_SITE = ['css', 'js', 'img', 'fonts', 'admin'];
rmSync('publicar', { recursive: true, force: true });
mkdirSync('publicar');
for (const pasta of ARQUIVOS_DO_SITE) cpSync(pasta, `publicar/${pasta}`, { recursive: true });
for (const arquivo of readdirSync('.').filter((a) => a.endsWith('.html'))) cpSync(arquivo, `publicar/${arquivo}`);

console.log(`[preparar-deploy] ok: site copiado para publicar/ (projeto ${url})`);
