# Papelaria Online

**MVP do Sistema de Vendas de Papelaria Online**: projeto final de ECOT11A (Laboratório de Engenharia de Software I), UNIFEI.
**Autor:** Gabriel Ribeiro Sgarbi, Engenharia de Computação.

Loja virtual de uma papelaria que vende só pela internet. O visitante navega e busca produtos sem login.
O cliente monta um carrinho salvo no banco, com reserva de estoque de 15 minutos, compra com pagamento
simulado e avalia o que comprou. O administrador gerencia produtos, categorias, pedidos e avaliações num painel separado.

- **Documento de requisitos:** [docs/Documento_de_Requisitos.pdf](docs/Documento_de_Requisitos.pdf)
- **Segurança (ameaças e proteções):** [docs/SEGURANCA.md](docs/SEGURANCA.md)
- **Casos de teste e testes de segurança:** [tests/CASOS_DE_TESTE.md](tests/CASOS_DE_TESTE.md)
- **Site publicado:** _(cole aqui o link do Netlify)_

## Funcionalidades por nível (seção 9.4)

| Nível | Funcionalidades | Requisitos |
|---|---|---|
| **Básico** | Cadastro e login com aceite do termo; página inicial com busca e categorias; página do produto; carrinho; finalizar compra com pagamento simulado; Meus pedidos | RF01, RF03, RF04, RF06 |
| **Intermediário** | Edição de perfil e exclusão de conta (LGPD); dados guardados no PostgreSQL; CRUD de produtos (com imagem) e categorias no painel; mudança de status dos pedidos | RF05, RF07, RE01 |
| **Avançado** | Reserva automática de 15 min (pg_cron) e conferência na finalização; avaliações só de quem comprou, com edição em até 7 dias; consulta de CEP no ViaCEP; resumo no painel (pedidos e faturamento do dia, estoque baixo) | RF02, RN01, RN02, RN04, RNF16 |

Fora do MVP (seção 11): pagamento real, bloqueio de conta (RN03), variações de cor e modelo, e frete.

## Tecnologias

- HTML5, CSS3 e JavaScript puro (ES6 com módulos), sem framework e sem bundler no site
- [supabase-js](https://supabase.com/docs/reference/javascript) **2.112.4** (versão fixa), copiado para `js/vendor/`
- Supabase: Auth, API REST, Storage e PostgreSQL com RLS, funções PL/pgSQL e pg_cron
- ViaCEP (endereço pelo CEP), Netlify (hospedagem) e Vitest (testes de unidade)
- Fontes Young Serif e Atkinson Hyperlegible (licença OFL), servidas pelo próprio site

## Organização das pastas

```
papelaria-projeto/
├── commit/     ← ESTE repositório Git (só o que pode ir para o GitHub público)
└── privado     ← pasta irmã, FORA do Git: chaves secretas, senhas, contas de teste, dumps
```

Dentro de `commit/`:

```
index.html, produto.html, carrinho.html, pedidos.html, perfil.html, login.html
admin/                 painel (resumo, produtos, categorias, pedidos, avaliações)
css/tema.css           ÚNICO lugar com as cores (paleta a definir com o cliente)
js/config.js           URL e chave PÚBLICA do Supabase
js/services/           acesso ao Supabase: supabase, auth, produtos, carrinho, pedidos, cep, avaliacoes, admin
js/views/              código de cada tela
js/utils/              formatação, validação, escape de HTML e cálculos
js/vendor/             supabase-js empacotado (gerado por npm run vendor)
fonts/                 fontes locais e suas licenças
supabase/migrations/   tabelas, funções, RLS, Storage, pg_cron e seed (rodar em ordem)
scripts/               verificador de segredos, hook de pre-commit, cópia do vendor e build do Netlify
tests/                 testes Vitest e roteiro CT01–CT15 e CS01–CS11
docs/                  documento de requisitos e SEGURANCA.md
```

As regras de segurança e de negócio ficam **no banco** (RLS e funções), nunca só no navegador.
Veja [docs/SEGURANCA.md](docs/SEGURANCA.md).

## Como rodar localmente (Windows)

Pré-requisitos: [Node.js](https://nodejs.org) 20 ou mais novo, [Git](https://git-scm.com) e uma conta gratuita no [Supabase](https://supabase.com).

### 1. Criar o projeto no Supabase
Em supabase.com → **New project**. Escolha um nome, uma senha do banco e a região (São Paulo).
**Guarde a senha do banco só na pasta privada**, nunca no repositório. Deixe a **Data API** ligada.

### 2. Rodar as migrations em ordem
No painel: **SQL Editor** → **New query**. Abra cada arquivo de `supabase/migrations/`, cole o conteúdo e clique em **Run**, **nesta ordem**:

`01_tabelas` → `02_perfis_e_admin` → `03_carrinho` → `04_pedidos` → `05_avaliacoes` → `06_rls` → `07_storage` → `08_pg_cron` → `09_seed` → `10_ajustes_security_advisor`

A `10` aplica as correções do Security Advisor do Supabase (veja [docs/SEGURANCA.md](docs/SEGURANCA.md)).
Migrations já aplicadas não são editadas: cada mudança no banco entra num arquivo novo, com o próximo número.

### 3. Ativar o pg_cron
Antes do arquivo `08_pg_cron.sql`: **Database → Extensions** → procure `pg_cron` → **Enable**.
Depois de rodar o 08, confira com `select * from cron.job;`: deve aparecer `liberar-reservas-vencidas`.

### 4. Configurar a autenticação (RNF13)
- **Authentication → Sign In / Providers → Email:**
  - **Confirm email** ligado;
  - **Minimum password length = 8**.
- **Tempo do token = 1 h:** em **Project Settings → JWT Keys** (em painéis antigos, **Authentication → Settings**),
  confira **Access token expiry = 3600** segundos (é o padrão). O supabase-js renova o token sozinho.
- **Authentication → URL Configuration:**
  - **Site URL:** `http://localhost:3000` (depois do deploy, troque pelo endereço do Netlify);
  - **Redirect URLs:** `http://localhost:3000/**` e, depois do deploy, `https://SEU-SITE.netlify.app/**`. Nenhum outro endereço.
- **Authentication → Rate Limits:** mantenha os valores padrão. Eles limitam as tentativas de login e cadastro (proteção contra força bruta).

### 5. Conferir o bucket de imagens
O `07_storage.sql` já cria o bucket público `produtos`: só PNG, JPEG e WEBP de até 2 MB, com upload só pelo admin.
Confira em **Storage → produtos → Configuration**.

### 6. Preencher `js/config.js`
Em **Project Settings → API Keys** (ou no botão **Connect**), copie a **Project URL** e a chave **anon / publishable**:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_CHAVE_PUBLICA = 'sb_publishable_... (ou eyJhbGciOi...)';
```

Essa chave é **pública por design** e pode ir para o GitHub, porque a proteção real é o RLS.
**Nunca** use aqui a *secret key* / *service_role*.

### 7. Instalar as ferramentas e o verificador de segredos
No PowerShell, dentro da pasta `commit`:

```powershell
npm install
```

O `npm install` também instala o **hook de pre-commit**: antes de cada commit o Git roda o verificador de segredos e bloqueia o commit se achar chave secreta, senha ou JWT que não seja anon.

### 8. Promover um usuário a admin
Crie sua conta **pelo site** e confirme o e-mail. Não use o "Add user" do painel: o banco exige o aceite do termo.
Depois rode no SQL Editor:

```sql
update perfis set papel = 'admin'
 where id = (select id from auth.users where email = 'seu-email@exemplo.com');
```

Saia e entre de novo. O menu da conta passa a mostrar **Painel do administrador**.
Não existe tela nem função para virar admin; só este comando no painel.

### 9. Subir o servidor local
Os módulos ES não funcionam abrindo o arquivo direto (`file://`). Na pasta `commit`:

```powershell
npx serve -l 3000
```

Abra **http://localhost:3000**. O arquivo `serve.json` mantém os endereços com `.html`, abre a loja em `/` e desliga a listagem de pastas.

Se a porta 3000 estiver ocupada, use outra (por exemplo `npx serve -l 5500`) e troque também a **Site URL** e as
**Redirect URLs** do Supabase (passo 4) para essa porta. Senão, o link de confirmação do e-mail não volta para a loja.
Outra opção é a extensão **Live Server** do VS Code, com a pasta `commit` aberta como raiz.

## Antes de cada commit

```powershell
npm run verificar     # procura segredos em todos os arquivos
git status            # confira a lista do que vai entrar
```

- Faça `git add` só de dentro da pasta `commit`.
- Se um segredo chegar a ir para o GitHub, apagar o arquivo **não basta**: troque a chave
  (Project Settings → API Keys) e a senha do banco (Project Settings → Database) no Supabase.

## Deploy no Netlify

1. Suba o repositório (pasta `commit`) para o GitHub, com `js/config.js` preenchido.
2. No `netlify.toml`, troque as duas ocorrências de `SEU-PROJETO` pelo id do seu projeto (o mesmo de `js/config.js`).
   O build confere isso e **falha de propósito** se a CSP e o `config.js` não apontarem para o mesmo projeto.
3. Em [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub**, escolha o repositório e clique em **Deploy**.
   As configurações de build vêm do `netlify.toml`, que publica só os arquivos do site.
4. No Supabase, em **Authentication → URL Configuration**, coloque o endereço do Netlify em **Site URL** e em **Redirect URLs**.
5. Confira os cabeçalhos de segurança (CS10) e cole o link no topo deste README.

## Testes

```powershell
npm test              # testes de unidade (Vitest)
npm run verificar     # verificador de segredos
```

Os testes de unidade cobrem subtotal e total do carrinho, validação de e-mail e senha, comentário obrigatório,
formatação de preço e CEP, escape de HTML, validação de `imagem_url` e redirecionamento seguro.
Os casos CT01 a CT15 e os testes de segurança CS01 a CS11, com os comandos SQL, estão em
[tests/CASOS_DE_TESTE.md](tests/CASOS_DE_TESTE.md).

## Atualizar o supabase-js

A versão fica fixa no `package.json` (nunca "latest"). Para trocar: mude a versão de `@supabase/supabase-js`,
rode `npm install` e `npm run vendor`, que gera de novo `js/vendor/supabase-js.js` e mostra o hash do arquivo.
