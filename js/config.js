// =============================================================
// Configuração do Supabase
//
// Onde achar os valores: painel do Supabase > Project Settings > API Keys
// (ou no botão "Connect" no topo do painel).
//   SUPABASE_URL           -> "Project URL"
//   SUPABASE_CHAVE_PUBLICA -> chave "anon public" (ou a "publishable key")
//
// Por que estes valores podem ficar no GitHub público?
// A URL e a chave anon/publishable são PÚBLICAS por design: qualquer
// visitante do site consegue vê-las no navegador. Elas só identificam o
// projeto. O que cada pessoa pode ler ou alterar é decidido no banco,
// pelas políticas RLS e pelas funções (supabase/migrations/06_rls.sql).
//
// NUNCA coloque aqui a chave secreta (secret key) nem a senha do banco:
// essas ficam fora do repositório.
// =============================================================

export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_CHAVE_PUBLICA = 'COLE-AQUI-A-CHAVE-ANON-PUBLICA';
