# Casos de teste CT01 a CT15 e testes de segurança CS01 a CS11

Roteiro para executar os casos de teste da seção 10 do Documento de Requisitos.
Para cada caso há os passos, o resultado esperado e um espaço para anotar o resultado obtido.

**Critério de aceite do MVP:** CT01 a CT03, CT10 e CT11 passam e nenhum erro grave fica aberto.

## Preparação

1. Siga o [README](../README.md) até o site rodar localmente (`http://localhost:3000`).
2. Crie **três contas de teste** pelo próprio site (aba "Criar conta"):
   - **Cliente A**
   - **Cliente B**
   - **Administrador**. Depois promova essa conta a admin (passo 7 do README).

   A confirmação de e-mail está ligada, então cada conta precisa de um e-mail que receba mensagens.
   Dica: no Gmail, `seuemail+clientea@gmail.com` e `seuemail+clienteb@gmail.com` chegam na mesma caixa.
   O e-mail de teste do Supabase tem limite de poucas mensagens por hora. Se ele acabar, confirme a conta de teste pelo SQL Editor:
   `update auth.users set email_confirmed_at = now() where email = 'EMAIL-DA-CONTA';`
3. Anote e-mails e senhas das contas de teste **só na pasta privada** (fora do Git), nunca neste repositório.
4. No **SQL Editor** do Supabase, anote o UUID de cada conta:

   ```sql
   select id, email from auth.users order by created_at;
   ```

### Como "virar" um usuário no SQL Editor (testes de RLS)

O SQL Editor roda como `postgres`, que ignora o RLS. Para testar as políticas, rode os comandos
dentro de uma transação. Ela finge ser um usuário logado e, no fim, desfaz tudo com `rollback`:

```sql
begin;
  -- finge ser o usuário com este UUID (é o mesmo token que o site envia)
  select set_config('request.jwt.claims',
                    json_build_object('sub', 'UUID-AQUI', 'role', 'authenticated')::text,
                    true);
  set local role authenticated;

  select auth.uid();   -- confira: deve mostrar o UUID acima

  -- ... comandos do teste ...
rollback;
```

> Selecione **todo** o bloco e clique em **Run**. Se aparecer um erro no meio, a transação
> é cancelada; isso é esperado nos testes que devem dar "erro de permissão".

---

## CT01: Adicionar produto ao carrinho sem estar logado

**Requisitos:** RF01, RNF02

**Passos:**
1. Saia da conta (menu da conta → Sair) ou abra uma janela anônima.
2. Abra qualquer produto com estoque, por exemplo a Caneta esferográfica.
3. Clique em **Adicionar ao carrinho**.
4. Faça login.

**Esperado:** o pedido é recusado e o cliente vai para a tela de login, com o aviso
"Faça login para usar o carrinho". Depois do login, volta para a página do mesmo produto (FA01).
O banco também recusa a chamada: sem login, a API responde *permission denied for function adicionar_ao_carrinho*.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT02: Adicionar produto com estoque e recarregar a página

**Requisitos:** RF01, RNF03

**Passos:**
1. Logado como Cliente A, abra a Caneta esferográfica e anote o estoque no SQL Editor:
   `select estoque from produtos where nome like 'Caneta%';`
2. Clique em **Adicionar ao carrinho** (quantidade 2).
3. Veja o contador do carrinho no cabeçalho mudar na hora (RNF04).
4. Recarregue a página (F5), feche o navegador e abra de novo, ou entre por outro navegador.
5. Abra o carrinho.
6. Rode de novo a consulta do passo 1.

**Esperado:** o item continua no carrinho, com o tempo de reserva, e o estoque disponível diminuiu 2 unidades.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT03: Adicionar produto com estoque zero

**Requisitos:** RF01

**Passos:**
1. Logado, abra a **Calculadora científica 240 funções**, que tem estoque 0 no seed.
2. Confira que o botão aparece desabilitado e a página mostra "Produto indisponível no momento".
3. Teste o FE01 (o produto esgota entre abrir a página e clicar): abra outro produto com estoque, deixe a página aberta, zere o estoque no SQL Editor
   (`update produtos set estoque = 0 where nome like 'Grampeador%';`) e clique em **Adicionar ao carrinho**.

**Esperado:** a mensagem "Produto indisponível." aparece e nada é reservado: o carrinho não muda.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT04: Item com reserva vencida

**Requisitos:** RN02

**Passos (no SQL Editor):**
1. Com o Cliente A tendo um item no carrinho, veja o estoque:
   ```sql
   select c.quantidade, c.reservado_ate, p.nome, p.estoque
     from carrinho_itens c join produtos p on p.id = c.produto_id;
   ```
2. Faça a reserva vencer:
   ```sql
   update carrinho_itens set reservado_ate = now() - interval '1 minute';
   ```
3. Espere até 1 minuto (o pg_cron roda a cada minuto) **ou** chame a função na hora:
   ```sql
   select liberar_reservas_vencidas();
   ```
4. Rode de novo a consulta do passo 1.

**Esperado:** o estoque volta a ter as unidades que estavam reservadas, o item **continua** no carrinho
e `reservado_ate` fica nulo. No site, o carrinho mostra "Reserva expirada".
Histórico do agendamento: `select * from cron.job_run_details order by start_time desc limit 5;`

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT05: Finalizar compra com reserva vencida e estoque insuficiente

**Requisitos:** RF06, RN04

**Passos:**
1. Cliente A coloca **3** unidades da Calculadora de mesa no carrinho (o seed tem 3).
2. No SQL Editor, simule a reserva vencida e outro cliente comprando 2 unidades:
   ```sql
   -- a reserva vence e as 3 unidades voltam ao estoque
   update carrinho_itens set reservado_ate = now() - interval '1 minute'
    where produto_id = (select id from produtos where nome like 'Calculadora de mesa%');
   select liberar_reservas_vencidas();
   -- outro cliente leva 2 unidades: sobra 1
   update produtos set estoque = 1 where nome like 'Calculadora de mesa%';
   ```
3. No site, abra o carrinho → **Finalizar compra**, preencha o endereço e clique em **Confirmar pedido e pagar**.
4. Veja o aviso e clique em **Confirmar com as mudanças**.

**Esperado:** no passo 3 o pedido **não** é criado. Aparece o aviso "só havia 1 unidade(s); a quantidade foi ajustada"
e o total é recalculado. No passo 4 o pedido é criado com status **Pago** (pagamento simulado).

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT06: Avaliar duas vezes o mesmo produto comprado

**Requisitos:** RF02, RNF06

**Passos:**
1. Cliente A, em **Meus pedidos**, clica em **Avaliar** num item pago, dá a nota, escreve o comentário e envia.
2. Confira que o botão "Avaliar" sumiu e no lugar aparece "Sua avaliação" (FE01).
3. Tente avaliar de novo pela API, no SQL Editor, como Cliente A:
   ```sql
   begin;
     select set_config('request.jwt.claims', json_build_object('sub','UUID-DO-CLIENTE-A','role','authenticated')::text, true);
     set local role authenticated;
     insert into avaliacoes (pedido_item_id, nota, comentario)
     values ((select pedido_item_id from avaliacoes limit 1), 5, 'segunda avaliação');
   rollback;
   ```

**Esperado:** a segunda avaliação é recusada com o erro
*duplicate key value violates unique constraint "avaliacoes_pedido_item_id_key"*.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT07: Enviar avaliação pela API sem ter comprado

**Requisitos:** RNF07

**Passos (SQL Editor, como Cliente B, que não comprou o item do Cliente A):**
```sql
-- id de um item de pedido do Cliente A
select i.id from pedido_itens i join pedidos p on p.id = i.pedido_id
 where p.cliente_id = 'UUID-DO-CLIENTE-A' limit 1;

begin;
  select set_config('request.jwt.claims', json_build_object('sub','UUID-DO-CLIENTE-B','role','authenticated')::text, true);
  set local role authenticated;
  insert into avaliacoes (pedido_item_id, nota, comentario)
  values (ID-DO-ITEM-ACIMA, 1, 'avaliação falsa');
rollback;
```

**Esperado:** erro de permissão: *Só é possível avaliar produtos que você comprou.* (código 42501).
No site, o Cliente B nem vê o botão "Avaliar" para esse produto (FA02 do cenário 02).

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT08: Enviar avaliação com comentário vazio

**Requisitos:** RNF08

**Passos:**
1. Em **Meus pedidos**, clique em **Avaliar**, escolha as estrelas e deixe o comentário vazio (ou só com espaços).
2. Clique em **Enviar avaliação**.
3. (Opcional) Pela API: o mesmo `insert` do CT06 com `comentario = '   '`.

**Esperado:** o envio é bloqueado e o campo fica destacado em vermelho com "O comentário é obrigatório".
Pela API, o banco recusa com *violates check constraint "avaliacoes_comentario_check"*.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT09: Cliente tenta editar avaliação publicada há 8 dias

**Requisitos:** RN01

**Passos:**
1. No SQL Editor (como `postgres`), envelheça a avaliação do Cliente A:
   ```sql
   update avaliacoes set publicado_em = now() - interval '8 days'
    where cliente_id = 'UUID-DO-CLIENTE-A';
   ```
2. No site, em **Meus pedidos**, confira que o botão **Editar** sumiu.
3. Tente editar pela API, como Cliente A:
   ```sql
   begin;
     select set_config('request.jwt.claims', json_build_object('sub','UUID-DO-CLIENTE-A','role','authenticated')::text, true);
     set local role authenticated;
     update avaliacoes set nota = 1 where cliente_id = 'UUID-DO-CLIENTE-A';  -- esperado: UPDATE 0
   rollback;
   ```
4. Como administrador, no **Painel → Avaliações**, edite a mesma avaliação.

**Esperado:** a edição do cliente é recusada: o comando altera **0 linhas**, porque o RLS esconde
a linha. O administrador consegue editar.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT10: Cliente B tenta ler o carrinho e os pedidos do Cliente A

**Requisitos:** RNF14

**Passos (SQL Editor):**
```sql
-- como postgres: confirme que o Cliente A tem dados
select count(*) from carrinho_itens where cliente_id = 'UUID-DO-CLIENTE-A';
select count(*) from pedidos        where cliente_id = 'UUID-DO-CLIENTE-A';

begin;
  select set_config('request.jwt.claims', json_build_object('sub','UUID-DO-CLIENTE-B','role','authenticated')::text, true);
  set local role authenticated;
  select count(*) from carrinho_itens where cliente_id = 'UUID-DO-CLIENTE-A';  -- esperado: 0
  select count(*) from pedidos        where cliente_id = 'UUID-DO-CLIENTE-A';  -- esperado: 0
  select count(*) from pedido_itens;                                           -- só os do B
  select count(*) from perfis;                                                 -- esperado: 1 (o próprio)
rollback;
```

Também dá para testar pelo navegador. Logado como Cliente B, abra o console (F12) e rode:
```js
const { supabase } = await import('/js/services/supabase.js');
await supabase.from('carrinho_itens').select('*');   // só itens do B
await supabase.from('pedidos').select('*');          // só pedidos do B
```

**Esperado:** nenhum registro do Cliente A é retornado.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT11: Cliente comum tenta cadastrar um produto

**Requisitos:** RF07, RNF15

**Passos (SQL Editor):**
```sql
begin;
  select set_config('request.jwt.claims', json_build_object('sub','UUID-DO-CLIENTE-A','role','authenticated')::text, true);
  set local role authenticated;
  insert into produtos (nome, preco, estoque, categoria_id)
  values ('Produto hacker', 1.00, 10, (select id from categorias limit 1));
rollback;
```

Pelo navegador, logado como cliente comum, no console (F12):
```js
const { supabase } = await import('/js/services/supabase.js');
await supabase.from('produtos').insert({ nome: 'Produto hacker', preco: 1, estoque: 1, categoria_id: 1 });
```

Também: abra `/admin/produtos.html` logado como cliente comum.

**Esperado:** erro de permissão, *new row violates row-level security policy for table "produtos"* (código 42501).
O painel mostra "Acesso restrito".

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT12: Buscar pelo texto `<script>alert(1)</script>`

**Requisitos:** RNF10

**Passos:**
1. Na caixa de busca, digite `<script>alert(1)</script>` e pressione Enter.

**Esperado:** nenhum alerta aparece. A página mostra *Resultados para "&lt;script&gt;alert(1)&lt;/script&gt;"*
como texto comum e "Nenhum produto encontrado", sugerindo categorias.
Na aba **Network**, o site está em HTTPS (no Netlify) e `http://` redireciona para `https://`.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT13: Informar um CEP válido e repetir com o ViaCEP bloqueado

**Requisitos:** RF05, RNF16

**Passos:**
1. Em **Meu perfil**, digite o CEP `37500-903`.
2. Confira que o endereço é preenchido em até 2 s.
3. Bloqueie o ViaCEP: DevTools (F12) → **Network** → clique com o botão direito numa requisição a
   `viacep.com.br` → **Block request domain** (ou Ctrl+Shift+P → "Show Network request blocking").
4. Apague o CEP e digite outro (ex.: `01001-000`).

**Esperado:** no passo 2 o endereço é preenchido em até 2 s. No passo 4 aparece "Não conseguimos buscar o
CEP agora. Digite o endereço normalmente." e os campos ficam liberados para digitar.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

## CT14: Medir a página inicial com a rede limitada a 4G

**Requisitos:** RNF09

**Passos:**
1. Abra o site publicado (Netlify) no Chrome, F12 → **Network**.
2. Marque **Disable cache** e escolha a limitação **Fast 4G** (ou "4G").
3. Recarregue a página e veja o tempo de **Load** no rodapé da aba Network.
4. (Opcional) Rode o **Lighthouse** em modo Mobile.

**Esperado:** carregamento completo em até 2 s.

**Resultado obtido:** ☐ Passou ☐ Falhou. Tempo medido: ______ s

---

## CT15: Abrir a loja com 360 px e 1920 px de largura

**Requisitos:** RNF12

**Passos:**
1. F12 → **Toggle device toolbar** (Ctrl+Shift+M) → largura **360** e depois **1920**.
2. Em cada largura, abra a página inicial, um produto, o carrinho e Meus pedidos.
3. No console, confira se há rolagem horizontal:
   ```js
   document.documentElement.scrollWidth <= window.innerWidth   // esperado: true
   ```
4. Rode o **Lighthouse → Accessibility** e veja o item de contraste.

**Esperado:** não há rolagem horizontal e o contraste é de no mínimo 4,5:1. As cores de `css/tema.css`
foram conferidas: o menor contraste entre texto e fundo é 4,98:1.

**Resultado obtido:** ☐ Passou ☐ Falhou. Observações: ______________________

---

# Testes de segurança adicionais

Complementam os CT acima. Os comandos SQL usam o mesmo bloco `begin … rollback` da Preparação,
que finge ser um usuário logado. As decisões de segurança estão explicadas em
[docs/SEGURANCA.md](../docs/SEGURANCA.md).

Nos testes pelo navegador, abra o console (F12), logado com a conta indicada, e importe o cliente do Supabase:

```js
const { supabase } = await import('/js/services/supabase.js');
```

---

## CS01: Cliente tenta virar admin

**Passos (SQL Editor, como Cliente A):**
```sql
begin;
  select set_config('request.jwt.claims', json_build_object('sub','UUID-DO-CLIENTE-A','role','authenticated')::text, true);
  set local role authenticated;
  update perfis set papel = 'admin' where id = 'UUID-DO-CLIENTE-A';
rollback;
```
Pelo navegador: `await supabase.from('perfis').update({ papel: 'admin' }).eq('id', 'UUID-DO-CLIENTE-A')`

**Esperado:** *permission denied for table perfis* (42501). O cliente só pode alterar nome, telefone,
CEP e endereço (GRANT por coluna). Não existe tela nem função para virar admin.

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS02: Cliente tenta inserir direto em `pedidos` ou `pedido_itens`

**Passos (navegador, como Cliente A):**
```js
await supabase.from('pedidos').insert({ cliente_id: 'UUID-DO-CLIENTE-A', valor_total: 0.01,
  endereco_entrega: 'x', forma_pagamento: 'PIX', status: 'PAGO' });
await supabase.from('pedido_itens').insert({ pedido_id: 1, produto_id: 1, quantidade: 1, preco_unitario: 0.01 });
```

**Esperado:** as duas chamadas voltam com erro *permission denied* (42501). Pedidos só nascem pela função `finalizar_pedido`.

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS03: Cliente tenta alterar `reservado_ate`, `preco_unitario` ou `valor_total`

**Passos (navegador, como Cliente A, com um item no carrinho e um pedido feito):**
```js
await supabase.from('carrinho_itens').update({ reservado_ate: '2099-01-01' }).neq('id', 0);
await supabase.from('pedido_itens').update({ preco_unitario: 0.01 }).neq('id', 0);
await supabase.from('pedidos').update({ valor_total: 0.01 }).neq('id', 0);
```

**Esperado:** as três chamadas dão *permission denied* (42501). Não existe GRANT de UPDATE nessas colunas.

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS04: Quantidade negativa, zero ou 1000 no carrinho

**Passos (navegador, como Cliente A):**
```js
await supabase.rpc('adicionar_ao_carrinho', { p_produto_id: 1, p_quantidade: -1 });
await supabase.rpc('adicionar_ao_carrinho', { p_produto_id: 1, p_quantidade: 0 });
await supabase.rpc('adicionar_ao_carrinho', { p_produto_id: 1, p_quantidade: 1000 });
await supabase.rpc('alterar_quantidade_carrinho', { p_produto_id: 1, p_quantidade: 1000 });
```

**Esperado:** todas são recusadas com *Quantidade inválida: escolha de 1 a 99 unidades.* Se o item já tem
quantidade perto de 99, a função limita a 99 e devolve quanto adicionou (FA02).

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS05: Usuário anônimo chama as funções RPC

**Passos:** saia da conta, abra o console em qualquer página da loja e rode:
```js
await supabase.rpc('adicionar_ao_carrinho', { p_produto_id: 1, p_quantidade: 1 });
await supabase.rpc('finalizar_pedido', { p_endereco: 'x', p_forma_pagamento: 'PIX' });
await supabase.rpc('excluir_minha_conta');
await supabase.rpc('liberar_reservas_vencidas');
```

**Esperado:** todas voltam com *permission denied for function …* (42501). A `liberar_reservas_vencidas`
também é recusada para clientes logados: só o pg_cron a executa.

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS06: Cliente A tenta ler perfil, carrinho ou pedidos do Cliente B

**Passos (navegador, como Cliente A):**
```js
await supabase.from('perfis').select('*').eq('id', 'UUID-DO-CLIENTE-B');
await supabase.from('carrinho_itens').select('*').eq('cliente_id', 'UUID-DO-CLIENTE-B');
await supabase.from('pedidos').select('*').eq('cliente_id', 'UUID-DO-CLIENTE-B');
```

**Esperado:** `data: []` (0 registros) nas três. O RLS esconde as linhas de outro cliente. Complementa o CT10.

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS07: Comentário e nome de produto com HTML malicioso

**Passos:**
1. Como Cliente A, avalie um produto comprado com o comentário `<img src=x onerror=alert(1)>`.
2. Como admin, cadastre ou edite um produto com o nome `<img src=x onerror=alert(1)>`.
3. Abra a página do produto, a página inicial e o painel.

**Esperado:** nenhum alerta aparece. O texto é mostrado literalmente, com os sinais `<` e `>`.
No DevTools (Elements), não existe nenhuma tag `<img src="x">` criada.

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS08: Upload de SVG, HTML, arquivo grande ou feito por cliente

**Passos:**
1. No painel (como admin), tente enviar como imagem de produto: um `.svg`, um `.html` renomeado e um `.png` com mais de 2 MB.
2. Como cliente comum, no console:
   ```js
   const arquivo = new File(['oi'], 'x.png', { type: 'image/png' });
   await supabase.storage.from('produtos').upload(crypto.randomUUID() + '.png', arquivo);
   ```
3. Como admin, no console, tente burlar o site:
   ```js
   const svg = new File(['<svg onload="alert(1)"/>'], 'x.svg', { type: 'image/svg+xml' });
   await supabase.storage.from('produtos').upload(crypto.randomUUID() + '.svg', svg, { contentType: 'image/svg+xml' });
   ```

**Esperado:**
- No passo 1, o site recusa ("Envie uma imagem PNG, JPG ou WEBP." / "no máximo 2 MB").
- No passo 2, o Storage recusa com *new row violates row-level security policy*.
- No passo 3, o Storage recusa pelo tipo de arquivo (*mime type not supported*) e pela política de extensão.

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS09: Redirecionamento para site externo depois do login

**Passos:** abra `/login.html?voltar=https://site-malicioso.com` e também
`/login.html?voltar=//site-malicioso.com/login.html`. Faça login.

**Esperado:** depois do login o site vai para `/index.html`, e nunca para o endereço externo. A função
`destinoSeguro` só aceita caminhos internos como `/produto.html?id=5`.
(O parâmetro do site se chama `voltar`.)

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## CS10: Cabeçalhos de segurança do site publicado

**Passos:**
1. Abra o site no Netlify, F12 → **Network** → clique no documento (primeira linha) → **Headers**.
2. Ou teste em <https://securityheaders.com> com o endereço do site.
3. Abra `http://` (sem o "s") com o endereço do site.

**Esperado:**
- Os cabeçalhos `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`,
  `Referrer-Policy` e `Permissions-Policy` estão presentes.
- O console não mostra nenhum erro de CSP ao navegar pela loja.
- `http://` redireciona para `https://`.

**Resultado obtido:** ☐ Passou ☐ Falhou. Nota no securityheaders.com: ______

---

## CS11: Verificador de segredos bloqueia o commit

**Passos (PowerShell, na pasta do repositório):**
```powershell
# o texto é montado em duas partes só para este documento não ser barrado pelo verificador
Set-Content teste-segredo.js ('const senha' + ' = "minhaSenha123";')
git add teste-segredo.js
git commit -m "teste"            # deve ser BLOQUEADO pelo hook
git rm --cached teste-segredo.js
Remove-Item teste-segredo.js
npm run verificar                # deve voltar a dizer "ok"
```

**Esperado:** o commit é bloqueado com a lista "POSSÍVEIS SEGREDOS ENCONTRADOS" e nenhum commit é criado.
Se o hook não rodar, instale com `npm install` (script `prepare`).

**Resultado obtido:** ☐ Passou ☐ Falhou

---

## Testes de unidade (Vitest)

```powershell
npm install
npm test
```

Cobrem o subtotal e o total do carrinho, a validação de e-mail e senha, o comentário obrigatório, a formatação
de preço e CEP e o escape de HTML. Eles ficam em `tests/*.test.js`.
