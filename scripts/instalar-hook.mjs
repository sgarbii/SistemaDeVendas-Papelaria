// Instala o hook de pre-commit do Git, que roda o verificador de segredos
// antes de cada commit e bloqueia o commit se achar algo.
// Roda sozinho no "npm install" (script "prepare" do package.json).
// Os hooks ficam em .git/hooks, que o Git não versiona; por isso este script.
import { existsSync, writeFileSync, chmodSync } from 'node:fs';

if (!existsSync('.git')) {
  // ex.: build do Netlify, que não tem a pasta .git
  console.log('[instalar-hook] sem pasta .git: nada a fazer.');
  process.exit(0);
}

const hook = `#!/bin/sh
# Instalado por scripts/instalar-hook.mjs — bloqueia o commit se houver segredo.
node scripts/verificar-segredos.mjs --staged
`;
writeFileSync('.git/hooks/pre-commit', hook);
chmodSync('.git/hooks/pre-commit', 0o755);
console.log('[instalar-hook] hook de pre-commit instalado em .git/hooks/pre-commit');
