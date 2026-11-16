# Segurança da Papelaria Online

Este documento explica, em linguagem simples, como o MVP se protege dos ataques mais comuns em lojas
virtuais. Ele complementa o Documento de Requisitos (RNF02, RNF06, RNF07, RNF10, RNF13, RNF14, RNF15 e RE01).

## A ideia principal: o navegador não é confiável

Tudo o que roda no navegador (HTML, CSS e JavaScript) pode ser lido e alterado por quem usa o site.
Basta apertar F12. Por isso:

- **as regras importantes ficam no banco de dados** (PostgreSQL no Supabase), em três camadas:
  1. **GRANT/REVOKE**: diz quais colunas cada tipo de usuário pode ler ou alterar;
  2. **RLS (Row Level Security)**: diz quais *linhas* cada usuário enxerga ou altera, com o padrão "negar tudo";
  3. **funções do banco**: fazem as operações sensíveis (reservar estoque, fechar pedido) numa transação só;
- **o site só ajuda o usuário**: valida formulários, esconde botões e mostra mensagens amigáveis.
  Se alguém pular o site e chamar a API direto, o banco recusa do mesmo jeito.

## Ameaças e onde cada uma é tratada

| Ameaça | O que é | Como o sistema se protege | Onde está |
|---|---|---|---|
| **XSS (Cross-Site Scripting)** | Alguém escreve código (`<script>`, `<img onerror=…>`) num comentário, nome de produto ou busca, e o navegador de outra pessoa executa esse código. | 1) Texto do usuário, do banco ou do ViaCEP nunca entra com `innerHTML`. A função `el()` cria os elementos e coloca o texto como `textContent`, que o navegador mostra como texto e não executa. 2) `escaparHtml()` testada. 3) A CSP do Netlify só permite scripts do próprio site, sem scripts ou estilos inline. 4) Sem eventos inline (`onclick=""`) no HTML. | `js/utils/html.js` (`el`, `escaparHtml`), `netlify.toml` (Content-Security-Policy), `tests/html.test.js`, CT12, CS07 |
| **Escalada de privilégio** | Um cliente tenta virar administrador, por exemplo mudando a coluna `papel` do próprio perfil. | 1) O cliente só tem permissão (GRANT) para alterar `nome`, `telefone`, `cep`, `endereco` e `numero_complemento`; a coluna `papel` fica de fora. 2) O cadastro sempre cria o perfil como `cliente`. 3) Não existe tela nem função para virar admin: isso só se faz por SQL no painel do Supabase. 4) O painel admin no site é só visual; quem protege é o RLS. | `06_rls.sql` (GRANT por coluna), `02_perfis_e_admin.sql` (`criar_perfil_novo_usuario`), `js/views/admin/painel.js`, CS01 |
| **Manipulação de preço** | O cliente altera o preço, o total ou o status do pedido antes de enviar (por exemplo, para pagar R$ 0,01). | 1) O navegador não manda preço nem total: `finalizar_pedido` recebe só o endereço e a forma de pagamento e calcula tudo com os preços do banco. 2) O cliente não tem permissão para inserir ou alterar `pedidos`, `pedido_itens` e `carrinho_itens`: só as funções gravam nessas tabelas. 3) CHECKs no banco (`preco > 0`, `quantidade` de 1 a 99). | `04_pedidos.sql` (`finalizar_pedido`), `03_carrinho.sql`, `06_rls.sql`, CS02, CS03, CS04 |
| **Acesso a dados de outro cliente** | O cliente B tenta ler o carrinho, os pedidos ou o endereço do cliente A, por exemplo mudando um id na requisição. | Políticas RLS em todas as tabelas: cada cliente só enxerga as linhas em que `cliente_id = auth.uid()` (o id que vem do token de login, que não dá para falsificar). O admin enxerga tudo por meio de `eh_admin()`. Toda política de INSERT/UPDATE tem `WITH CHECK`, para ninguém gravar um registro em nome de outro. | `06_rls.sql`, CT10, CS06 |
| **Condição de corrida no estoque** | Dois clientes clicam em "comprar" na última unidade ao mesmo tempo e os dois levam. | As funções travam a linha do produto (`SELECT … FOR UPDATE`) antes de mexer no estoque. O segundo cliente espera o primeiro terminar e então vê o estoque já descontado. O `CHECK (estoque >= 0)` impede estoque negativo. As funções sempre travam os produtos na mesma ordem (por id), para não haver travamento circular. | `03_carrinho.sql`, `04_pedidos.sql`, `01_tabelas.sql` |
| **Vazamento de chaves** | A chave secreta do Supabase (que ignora o RLS) ou a senha do banco vai parar no GitHub. | 1) O site só usa a chave **anon/publishable**, que é pública por design; a proteção real é o RLS. 2) O projeto tem duas pastas: só a pasta `commit` é repositório Git; segredos ficam numa pasta privada fora do Git. 3) `.gitignore` bloqueia `.env`, dumps e CSV. 4) O verificador de segredos (`npm run verificar`) procura chaves secretas, JWTs que não são anon, senhas e endereços de banco, e roda sozinho antes de cada commit (hook de pre-commit). 5) Se um segredo vazar, a chave é **trocada** no Supabase: apagar o arquivo não basta. | `js/config.js`, `.gitignore`, `scripts/verificar-segredos.mjs`, `scripts/instalar-hook.mjs`, CS11 |
| **Upload malicioso** | O admin (ou alguém com a conta dele) envia um SVG ou HTML com script, ou um arquivo enorme. | 1) O bucket `produtos` só aceita PNG, JPEG e WEBP de até 2 MB. SVG e HTML são bloqueados porque podem carregar script. 2) Só o admin envia, altera ou apaga arquivos (políticas em `storage.objects`). 3) O site gera o nome do arquivo (UUID) e ignora o nome original. 4) `imagem_url` só aceita imagens do próprio site ou do Storage do projeto (CHECK no banco e `imagemPermitida()` no site). | `07_storage.sql`, `js/services/admin.js` (`enviarImagem`), `11_fotos_e_tempo_real.sql` (CHECK de `imagem_url`), `js/utils/validacao.js`, CS08 |
| **Open redirect** | Um link falso como `login.html?voltar=https://site-falso.com` leva o cliente, depois do login, a um site que imita a loja. | `destinoSeguro()` só aceita caminhos internos do próprio site (por exemplo `/produto.html?id=5`). Qualquer outra coisa volta para a página inicial. | `js/utils/validacao.js`, `tests/validacao.test.js`, CS09 |
| **Força bruta no login** | Um robô testa milhares de senhas numa conta. | 1) Senha mínima de 8 caracteres (RNF13), guardada só como hash (bcrypt) pelo Supabase Auth. 2) O Supabase Auth limita o número de tentativas de login e cadastro por IP (rate limit, mantido no padrão). 3) Confirmação de e-mail ligada. 4) A sessão (JWT) dura 1 hora e é renovada automaticamente. O bloqueio de conta após 5 erros (RN03) ficou para depois do MVP (seção 9.4). | Painel do Supabase (Authentication), `js/services/auth.js`, README |

## Outras proteções

- **Mensagens de erro**: o usuário nunca vê o erro bruto do banco, que poderia revelar nomes de tabelas. `traduzirErro()` troca cada erro por uma mensagem amigável (`js/services/supabase.js`).
- **Busca**: feita só pelo query builder do supabase-js, sem montar texto de consulta. O termo tem no máximo 100 caracteres e os curingas `%` e `_` são escapados (`js/services/produtos.js`).
- **Funções `SECURITY DEFINER`**, que rodam com permissão de dono: usam `search_path = ''` e nomes completos (`public.produtos`), conferem `auth.uid()` no início, validam as entradas (quantidade de 1 a 99, produto existente e ativo) e só podem ser chamadas por usuários logados. `liberar_reservas_vencidas` não pode ser chamada por ninguém pela API, só pelo pg_cron.
- **Sem SQL dinâmico**: nenhuma função monta comandos SQL juntando textos.
- **Bibliotecas sem CDN**: o supabase-js (versão fixa 2.112.4) e as fontes ficam no próprio site (`js/vendor/`, `fonts/`). Assim a CSP pode ser `script-src 'self'` e o site não faz requisições a terceiros.
- **Cabeçalhos HTTP** (`netlify.toml`): CSP, HSTS (só HTTPS), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy` (câmera, microfone e localização desligados). O Netlify redireciona HTTP para HTTPS.
- **Tempo real no dashboard**: o Supabase Realtime respeita o RLS, então só o admin recebe os eventos dos pedidos de todos os clientes; um cliente comum só receberia os dos próprios pedidos. A CSP libera apenas o `wss://` do próprio projeto (`11_fotos_e_tempo_real.sql`, `js/services/admin.js`).
- **Relatório CSV**: o relatório só traz dados gerados pelo sistema (número, data, situação, pagamento, itens e total), nada digitado pelo cliente. Mesmo assim, por defesa em profundidade, células que começam com `=`, `+`, `-` ou `@` ganham um apóstrofo na frente, para o Excel não executá-las como fórmula (*CSV injection*) (`celulaCsv()` em `js/utils/painel.js`, testada).
- **Colunas das avaliações** (auditoria de 16/11/2026): a leitura pública de `avaliacoes` liberava todas as colunas, e qualquer visitante podia pedir `cliente_id` e ligar as avaliações de uma mesma pessoa. A migration `12` passou a liberar só as colunas que as telas usam; `cliente_id` não é lido pela API por ninguém (CS12).
- **Deploy**: só os arquivos do site são publicados (`scripts/preparar-deploy.mjs`); migrations, testes e scripts não vão para o ar.

## Security Advisor do Supabase

O painel do Supabase tem um verificador automático de segurança, o **Security Advisor**. Resultado e o que foi feito:

| Aviso | O que significa | Decisão |
|---|---|---|
| **Public Bucket Allows Listing** (`storage.produtos`) | A política de leitura em `storage.objects` deixava qualquer pessoa listar todos os arquivos do bucket. | **Corrigido** na migration `10`: a política foi removida. Como o bucket é público, cada imagem continua abrindo pela URL pública, mas ninguém mais consegue listar os arquivos. |
| **Signed-In Users Can Execute SECURITY DEFINER Function**: `eh_admin()` | A função de checagem de admin podia ser chamada pela API. | **Corrigido** na migration `10`: ela foi para o schema `interno`, que a API não publica. As políticas RLS continuam usando a função normalmente. |
| **Signed-In Users Can Execute SECURITY DEFINER Function**: `adicionar_ao_carrinho`, `alterar_quantidade_carrinho`, `remover_do_carrinho`, `finalizar_pedido`, `excluir_minha_conta` | Funções que rodam com permissão de dono podem ser chamadas por usuários logados. | **Aceito, de propósito.** Essas funções são a *única* porta para gravar no carrinho e nos pedidos: o cliente não tem permissão de escrita nessas tabelas, então não consegue forjar preço, total, status ou reserva. Cada função confere quem está logado (`auth.uid()`), valida as entradas (ids e quantidade de 1 a 99), usa `search_path = ''` e não recebe preço nem total. Visitantes sem login não podem chamá-las. Trocar para `SECURITY INVOKER` exigiria dar ao cliente permissão de escrita direta nas tabelas, o que seria **menos** seguro. |
| **Leaked Password Protection Disabled** (Auth) | O Supabase pode recusar senhas que já vazaram na internet (base do *Have I Been Pwned*). | É uma opção do painel (**Authentication → Sign In / Providers → Email**: *Prevent use of leaked passwords*), disponível só nos planos pagos. No plano gratuito do MVP o aviso fica. As outras defesas continuam ativas: senha mínima de 8 caracteres, hash bcrypt, confirmação de e-mail e limite de tentativas. |

## LGPD (RE01)

- **Coleta mínima**: nome, e-mail, telefone e endereço, só para as vendas.
- **Consentimento**: o aceite do termo é obrigatório no cadastro, conferido no banco, e a data do aceite fica gravada (`perfis.termo_aceito_em`).
- **Exclusão da conta**: `excluir_minha_conta()` apaga o perfil, o carrinho e o usuário do Auth. Os pedidos e as avaliações continuam guardados, mas sem identificar a pessoa (`cliente_id` vazio e endereço apagado).
- **Sem rastreamento**: nenhum analytics, rastreador, fonte ou script de terceiros. A única API externa é o ViaCEP, que recebe só o CEP.
- **Dados de teste**: o seed tem só produtos fictícios. Nenhum dado real vai para migrations, testes ou prints.
