-- =============================================================
-- 09_seed.sql
-- Dados iniciais: categorias e produtos de papelaria.
-- As imagens são SVGs locais do site (pasta img/produtos/).
--
-- total_vendido começa com valores de exemplo (vendas anteriores ao
-- sistema) para a página inicial já ter "mais populares" (RF03).
-- nota_media começa em 0: ela só vem das avaliações reais (RF02).
--
-- Dois produtos servem para os casos de teste:
--   - Calculadora científica: estoque 0 (CT03, "Produto indisponível")
--   - Impressora e Calculadora de mesa: estoque baixo (resumo do painel)
-- =============================================================

insert into public.categorias (nome) values
  ('Escolar'),
  ('Cadernos e Papéis'),
  ('Escritório'),
  ('Informática'),
  ('Arte e Desenho'),
  ('Organização');

insert into public.produtos (nome, descricao, preco, imagem_url, estoque, total_vendido, categoria_id)
select p.nome, p.descricao, p.preco, '/img/produtos/' || p.imagem || '.svg',
       p.estoque, p.total_vendido, c.id
  from (values
    -- Escolar
    ('Caneta esferográfica azul – kit com 10',
     'Canetas de ponta média 1,0 mm, escrita macia e tinta que seca rápido. Corpo transparente para ver a carga.',
     19.90, 'caneta-azul', 150, 320, 'Escolar'),
    ('Lápis grafite HB – caixa com 12',
     'Lápis de madeira reflorestada com grafite HB resistente, ideal para escrever e desenhar.',
     14.50, 'lapis-grafite', 200, 280, 'Escolar'),
    ('Borracha branca macia – kit com 4',
     'Borracha de vinil que apaga sem borrar e sem rasgar o papel. Com cinta protetora.',
     6.90, 'borracha', 180, 190, 'Escolar'),
    ('Apontador com depósito',
     'Apontador com lâmina de aço e depósito transparente para as raspas. Para lápis comuns.',
     7.50, 'apontador', 90, 140, 'Escolar'),

    -- Cadernos e Papéis
    ('Caderno universitário 10 matérias – 200 folhas',
     'Caderno espiral com capa dura, 200 folhas pautadas e divisórias coloridas.',
     32.90, 'caderno-10-materias', 75, 260, 'Cadernos e Papéis'),
    ('Papel sulfite A4 – resma com 500 folhas',
     'Papel branco 75 g/m², tamanho A4 (210 x 297 mm), para impressoras jato de tinta e laser.',
     29.90, 'papel-sulfite', 60, 230, 'Cadernos e Papéis'),
    ('Bloco de notas adesivas 76 x 76 mm – 4 blocos',
     'Quatro blocos de 100 folhas em cores sortidas, com adesivo que remove sem deixar marca.',
     12.90, 'bloco-adesivo', 110, 170, 'Cadernos e Papéis'),

    -- Escritório
    ('Grampeador de mesa 26/6 – até 20 folhas',
     'Grampeador de metal com base antiderrapante. Usa grampos 26/6 e grampeia até 20 folhas.',
     34.90, 'grampeador', 40, 85, 'Escritório'),
    ('Calculadora de mesa 12 dígitos',
     'Visor grande inclinado, teclas macias e alimentação solar com bateria de reserva.',
     49.90, 'calculadora-mesa', 3, 60, 'Escritório'),
    ('Calculadora científica 240 funções',
     'Funções de trigonometria, estatística e frações. Ideal para ensino médio e faculdade.',
     89.90, 'calculadora-cientifica', 0, 45, 'Escritório'),
    ('Marca-texto – kit com 6 cores',
     'Marca-textos com ponta chanfrada e tinta fluorescente que não atravessa o papel.',
     22.90, 'marca-texto', 130, 210, 'Escritório'),

    -- Informática
    ('Impressora multifuncional jato de tinta Wi-Fi',
     'Imprime, copia e digitaliza. Conexão Wi-Fi e USB, impressão pelo celular e bandeja para 60 folhas.',
     899.00, 'impressora', 4, 35, 'Informática'),
    ('Cartucho de tinta preto',
     'Cartucho original de tinta preta, rendimento aproximado de 180 páginas.',
     89.90, 'cartucho', 25, 70, 'Informática'),
    ('Mouse sem fio 1600 dpi',
     'Mouse óptico sem fio com receptor USB, três níveis de sensibilidade e pilha inclusa.',
     69.90, 'mouse', 45, 120, 'Informática'),
    ('Pen drive 64 GB USB 3.0',
     'Pen drive compacto com 64 GB e conexão USB 3.0, até 10 vezes mais rápido que o USB 2.0.',
     49.90, 'pendrive', 70, 150, 'Informática'),
    ('Teclado USB ABNT2',
     'Teclado com fio no padrão brasileiro ABNT2, com ç e teclas silenciosas.',
     79.90, 'teclado', 30, 55, 'Informática'),

    -- Arte e Desenho
    ('Lápis de cor – 36 cores',
     'Lápis de cor com pigmentos vivos e minas resistentes à quebra. Estojo de papelão.',
     42.90, 'lapis-cor', 55, 175, 'Arte e Desenho'),
    ('Tinta guache – 6 cores de 15 ml',
     'Tinta guache lavável e atóxica, com cores que se misturam facilmente.',
     12.90, 'guache', 80, 95, 'Arte e Desenho'),
    ('Kit de pincéis – 5 unidades',
     'Pincéis de cerdas sintéticas em tamanhos variados, para guache, aquarela e acrílica.',
     18.90, 'pinceis', 50, 65, 'Arte e Desenho'),
    ('Bloco para desenho A4 – 20 folhas 180 g/m²',
     'Papel encorpado para lápis, giz, nanquim e tintas leves. Folhas destacáveis.',
     24.90, 'bloco-desenho', 40, 50, 'Arte e Desenho'),

    -- Organização
    ('Pasta catálogo com 50 plásticos',
     'Pasta com capa de polipropileno e 50 envelopes plásticos para folhas A4.',
     24.90, 'pasta-catalogo', 65, 80, 'Organização'),
    ('Organizador de mesa com 4 divisórias',
     'Porta-objetos de madeira com quatro espaços para canetas, lápis, clipes e bilhetes.',
     39.90, 'organizador', 20, 40, 'Organização')
  ) as p (nome, descricao, preco, imagem, estoque, total_vendido, categoria)
  join public.categorias c on c.nome = p.categoria;
