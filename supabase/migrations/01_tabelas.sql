-- =============================================================
-- 01_tabelas.sql
-- Tabelas do sistema, derivadas do diagrama de classes (seções 6.2 e 9.2).
-- Rode os arquivos desta pasta em ordem no SQL Editor do Supabase.
--
-- As restrições CHECK repetem no banco as validações do site:
-- mesmo que alguém chame a API direto, dado inválido não entra.
-- =============================================================

-- Situações possíveis de um pedido (enum StatusPedido do diagrama de classes)
create type public.status_pedido as enum (
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'ENVIADO',
  'ENTREGUE',
  'CANCELADO'
);

-- Dados do cliente e do administrador (classes Usuario, Cliente e Administrador).
-- E-mail e senha ficam no Supabase Auth (auth.users), com a senha só como hash (RNF13).
create table public.perfis (
  id                 uuid primary key references auth.users (id) on delete cascade,
  nome               text not null check (trim(nome) <> '' and char_length(nome) <= 100),
  telefone           text check (telefone ~ '^[0-9]{10,11}$'),        -- só dígitos, com DDD
  cep                text check (cep ~ '^[0-9]{8}$'),
  endereco           text check (char_length(endereco) <= 200),       -- rua, bairro, cidade - UF
  numero_complemento text check (char_length(numero_complemento) <= 100),
  papel              text not null default 'cliente' check (papel in ('cliente', 'admin')),
  termo_aceito_em    timestamptz not null   -- RE01: data do aceite do termo de uso de dados
);

create table public.categorias (
  id   bigint generated always as identity primary key,
  nome text not null unique check (trim(nome) <> '' and char_length(nome) <= 60)
);

create table public.produtos (
  id            bigint generated always as identity primary key,
  nome          text not null check (trim(nome) <> '' and char_length(nome) <= 150),
  descricao     text not null default '' check (char_length(descricao) <= 2000),
  preco         numeric(10, 2) not null check (preco > 0),
  -- só imagens do próprio site (seed) ou do Storage do projeto (upload do admin)
  imagem_url    text check (
                  imagem_url ~ '^/img/produtos/[a-z0-9-]+\.svg$'
                  or imagem_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/produtos/[a-f0-9-]+\.(png|jpg|webp)$'
                ),
  estoque       integer not null default 0 check (estoque >= 0), -- disponível, já descontadas as reservas
  nota_media    numeric(2, 1) not null default 0,  -- calculada pelo trigger das avaliações
  total_vendido integer not null default 0 check (total_vendido >= 0), -- somado por finalizar_pedido
  categoria_id  bigint not null references public.categorias (id) on delete restrict,
  ativo         boolean not null default true      -- "remover" no painel só desativa (mantém o histórico)
);
create index produtos_categoria_idx on public.produtos (categoria_id);

-- Itens do carrinho (classe ItemCarrinho). O carrinho é o conjunto de itens do cliente.
create table public.carrinho_itens (
  id            bigint generated always as identity primary key,
  cliente_id    uuid not null references public.perfis (id) on delete cascade,
  produto_id    bigint not null references public.produtos (id) on delete cascade,
  quantidade    integer not null check (quantidade between 1 and 99),
  reservado_ate timestamptz,   -- RN02: fim da reserva de 15 min; null = sem reserva (venceu)
  unique (cliente_id, produto_id)   -- um registro por cliente e produto
);
create index carrinho_itens_produto_idx on public.carrinho_itens (produto_id);

create table public.pedidos (
  id               bigint generated always as identity primary key,
  cliente_id       uuid references public.perfis (id) on delete set null, -- RE01: pedido fica sem identificar o cliente
  data             timestamptz not null default now(),
  valor_total      numeric(10, 2) not null check (valor_total >= 0),
  endereco_entrega text not null check (trim(endereco_entrega) <> '' and char_length(endereco_entrega) <= 400),
  forma_pagamento  text not null check (forma_pagamento in ('PIX', 'CARTAO', 'BOLETO')), -- simulado (9.4)
  status           public.status_pedido not null default 'AGUARDANDO_PAGAMENTO'
);
create index pedidos_cliente_idx on public.pedidos (cliente_id);
create index pedidos_data_idx on public.pedidos (data);

create table public.pedido_itens (
  id             bigint generated always as identity primary key,
  pedido_id      bigint not null references public.pedidos (id) on delete cascade,
  produto_id     bigint not null references public.produtos (id) on delete restrict,
  quantidade     integer not null check (quantidade between 1 and 99),
  preco_unitario numeric(10, 2) not null check (preco_unitario >= 0)  -- preço do momento da compra
);
create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id);
create index pedido_itens_produto_idx on public.pedido_itens (produto_id);

create table public.avaliacoes (
  id             bigint generated always as identity primary key,
  pedido_item_id bigint not null unique references public.pedido_itens (id) on delete cascade, -- RNF06: 1 por item
  produto_id     bigint not null references public.produtos (id),  -- preenchido pelo trigger (05_avaliacoes.sql)
  cliente_id     uuid references public.perfis (id) on delete set null, -- RE01: avaliação fica anônima
  nota           smallint not null check (nota between 1 and 5),
  -- RNF08: comentário obrigatório, de 1 a 1000 caracteres, sem ser só espaços
  comentario     text not null check (trim(comentario) <> '' and char_length(comentario) <= 1000),
  publicado_em   timestamptz not null default now()
);
create index avaliacoes_produto_idx on public.avaliacoes (produto_id);
create index avaliacoes_cliente_idx on public.avaliacoes (cliente_id);
