// Verificador de segredos: impede que chaves e senhas vão para o GitHub.
//
//   npm run verificar          -> confere todos os arquivos do repositório
//   (hook de pre-commit)       -> confere só o que está no "git add" (--staged)
//
// Procura:
//   - chaves secretas do Supabase (sb_secret_..., service_role com valor);
//   - JWTs cujo "role" não seja "anon" (a única chave que pode ser pública);
//   - endereços de banco (postgres://...), chaves privadas e senhas escritas;
//   - arquivos .env e qualquer referência à pasta privada do projeto.
// Se achar algo, mostra onde e termina com erro (o commit é bloqueado).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, extname, join, relative } from 'node:path';

const PASTAS_IGNORADAS = new Set(['.git', 'node_modules', 'publicar', 'coverage']);
const EXTENSOES_BINARIAS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2']);
const ESTE_ARQUIVO = 'scripts/verificar-segredos.mjs'; // contém os próprios padrões

// [descrição, expressão regular]
const PADROES = [
  ['chave secreta do Supabase (sb_secret_)', /sb_secret_[A-Za-z0-9_-]{16,}/],
  ['chave service_role com valor', /service[_-]?role[\w-]*["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/i],
  ['endereço de banco com usuário/senha (postgres://)', /postgres(?:ql)?:\/\//i],
  ['chave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  // senha = "abc123" / password: 'xyz' / "senha": "..." (não pega textos como "PASSWORD_RECOVERY":"...")
  ['senha escrita no código', /(?<![\w"'])(senha|password|passwd|pwd|secret)\w*\s*[:=]\s*["'][^"'\s]{6,}["']|["'](senha|password|passwd|pwd|secret)["']\s*:\s*["'][^"'\s]{6,}["']/i],
  ['senha em formato .env', /^\s*[A-Z0-9_]*(PASSWORD|SENHA|SECRET)[A-Z0-9_]*\s*=\s*\S+/m],
  ['referência à pasta privada (fora do Git)', /privado[\\/]/i],
];
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

// Um JWT só pode ir para o repositório se for a chave pública (role "anon")
function problemaNoJwt(token) {
  try {
    const carga = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return carga.role === 'anon' ? null : `JWT com role "${carga.role ?? 'desconhecido'}" (só a chave anon pode ser pública)`;
  } catch {
    return 'JWT que não deu para ler (confira se não é uma chave secreta)';
  }
}

function problemasNoNome(caminho) {
  const nome = basename(caminho).toLowerCase();
  if (nome === '.env' || nome.startsWith('.env.')) return ['arquivo .env (variáveis de ambiente ficam fora do Git)'];
  if (['.pem', '.key', '.p12', '.pfx'].includes(extname(nome)) || nome.startsWith('id_rsa')) return ['arquivo de chave privada'];
  return [];
}

function verificarTexto(caminho, texto) {
  const achados = problemasNoNome(caminho).map((motivo) => ({ caminho, linha: 0, motivo }));
  texto.split(/\r?\n/).forEach((conteudoLinha, i) => {
    for (const [motivo, padrao] of PADROES) {
      if (padrao.test(conteudoLinha)) achados.push({ caminho, linha: i + 1, motivo });
    }
    for (const token of conteudoLinha.match(JWT) ?? []) {
      const motivo = problemaNoJwt(token);
      if (motivo) achados.push({ caminho, linha: i + 1, motivo });
    }
  });
  return achados;
}

function listarTodos(pasta, base = pasta) {
  let arquivos = [];
  for (const nome of readdirSync(pasta)) {
    if (PASTAS_IGNORADAS.has(nome)) continue;
    const completo = join(pasta, nome);
    if (statSync(completo).isDirectory()) arquivos = arquivos.concat(listarTodos(completo, base));
    else arquivos.push(relative(base, completo).replaceAll('\\', '/'));
  }
  return arquivos;
}

const somenteStaged = process.argv.includes('--staged');
const arquivos = somenteStaged
  ? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
      .split('\n').filter(Boolean)
  : listarTodos('.');

let achados = [];
for (const caminho of arquivos) {
  if (caminho === ESTE_ARQUIVO) continue;
  if (EXTENSOES_BINARIAS.has(extname(caminho).toLowerCase())) {
    achados = achados.concat(problemasNoNome(caminho).map((motivo) => ({ caminho, linha: 0, motivo })));
    continue;
  }
  // no modo --staged, lê a versão que vai entrar no commit (não a da pasta)
  const texto = somenteStaged
    ? execFileSync('git', ['show', `:${caminho}`], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
    : readFileSync(caminho, 'utf8');
  achados = achados.concat(verificarTexto(caminho, texto));
}

if (achados.length > 0) {
  console.error('\n[verificar-segredos] POSSÍVEIS SEGREDOS ENCONTRADOS:\n');
  for (const a of achados) console.error(`  ${a.caminho}${a.linha ? `:${a.linha}` : ''}  ->  ${a.motivo}`);
  console.error('\nTire esses dados do repositório (guarde-os na pasta privada, fora do Git).');
  console.error('Se um segredo já foi para o GitHub, TROQUE a chave no painel do Supabase.\n');
  process.exit(1);
}
console.log(`[verificar-segredos] ok: ${arquivos.length} arquivo(s) conferido(s), nenhum segredo encontrado.`);
