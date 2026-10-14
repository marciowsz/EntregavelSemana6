// =============================================================================
// 11_mongodb.js — Introdução ao MongoDB (domínio E-commerce)
// Executar com:  mongosh 11_mongodb.js
//
// Collections:
//   clientes   -> endereços EMBUTIDOS (embedding)
//   produtos   -> categoria embutida; atributos variáveis (esquema flexível)
//   pedidos    -> itens e pagamento EMBUTIDOS; cliente REFERENCIADO (_id)
//   avaliacoes -> REFERENCIA produto e cliente (crescem indefinidamente)
// =============================================================================

db = db.getSiblingDB("ecommerce");
db.dropDatabase(); // garante execução idempotente

// IDs pré-definidos para permitir as referências entre collections
const cli = { ana: new ObjectId(), bruno: new ObjectId(), carla: new ObjectId() };
const prod = {
  notebook: new ObjectId(), fone: new ObjectId(), livro: new ObjectId(),
  camiseta: new ObjectId(), cafeteira: new ObjectId()
};

// -----------------------------------------------------------------------------
// 1. CLIENTES — Embedding de endereços
// -----------------------------------------------------------------------------
db.clientes.insertMany([
  {
    _id: cli.ana, nome: "Ana Souza", email: "ana@email.com", cpf: "111.111.111-11",
    data_cadastro: new Date("2026-01-10"),
    enderecos: [
      { tipo: "residencial", rua: "Rua das Flores, 100", cidade: "São Paulo", uf: "SP", cep: "01000-000", principal: true },
      { tipo: "trabalho", rua: "Av. Paulista, 1500", cidade: "São Paulo", uf: "SP", cep: "01310-100", principal: false }
    ]
  },
  {
    _id: cli.bruno, nome: "Bruno Lima", email: "bruno@email.com", cpf: "222.222.222-22",
    data_cadastro: new Date("2026-02-15"),
    enderecos: [
      { tipo: "residencial", rua: "Rua XV, 50", cidade: "Curitiba", uf: "PR", cep: "80000-000", principal: true }
    ]
  },
  {
    _id: cli.carla, nome: "Carla Mendes", email: "carla@email.com", cpf: "333.333.333-33",
    data_cadastro: new Date("2026-03-20"),
    telefone: "(31) 99999-0000", // campo que só este cliente tem
    enderecos: [
      { tipo: "residencial", rua: "Rua da Bahia, 900", cidade: "Belo Horizonte", uf: "MG", cep: "30000-000", principal: true }
    ]
  }
]);

// -----------------------------------------------------------------------------
// 2. PRODUTOS — Flexibilidade de esquema: cada categoria tem atributos próprios
// -----------------------------------------------------------------------------
db.produtos.insertMany([
  {
    _id: prod.notebook, nome: "Notebook Pro 14", descricao: "Notebook leve com processador rápido e tela 14 polegadas",
    preco: 5499.90, estoque: 12, ativo: true,
    categoria: { nome: "Eletrônicos", slug: "eletronicos" },
    especificacoes: { processador: "8 núcleos", ram_gb: 16, armazenamento_gb: 512, voltagem: "bivolt" }
  },
  {
    _id: prod.fone, nome: "Fone Bluetooth Wave", descricao: "Fone sem fio com cancelamento de ruído",
    preco: 399.00, estoque: 40, ativo: true,
    categoria: { nome: "Eletrônicos", slug: "eletronicos" },
    especificacoes: { bateria_horas: 30, cor: "preto" }
  },
  {
    _id: prod.livro, nome: "Banco de Dados na Prática", descricao: "Livro sobre modelagem relacional e NoSQL",
    preco: 89.90, estoque: 100, ativo: true,
    categoria: { nome: "Livros", slug: "livros" },
    autor: "J. Silva", isbn: "978-85-0000-000-0", paginas: 320
  },
  {
    _id: prod.camiseta, nome: "Camiseta Básica Algodão", descricao: "Camiseta 100% algodão",
    preco: 59.90, estoque: 0, ativo: true,
    categoria: { nome: "Moda", slug: "moda" },
    variacoes: [ { tamanho: "P", cor: "branca" }, { tamanho: "M", cor: "branca" }, { tamanho: "G", cor: "preta" } ]
  },
  {
    _id: prod.cafeteira, nome: "Cafeteira Expresso", descricao: "Cafeteira expresso com vaporizador de leite",
    preco: 899.00, estoque: 7, ativo: false,
    categoria: { nome: "Casa", slug: "casa" },
    especificacoes: { voltagem: "220v", pressao_bar: 15 }
  }
]);

// -----------------------------------------------------------------------------
// 3. PEDIDOS — Itens e pagamento embutidos; cliente referenciado
//    Os itens guardam um "snapshot" de nome e preço do momento da compra.
// -----------------------------------------------------------------------------
db.pedidos.insertMany([
  {
    cliente_id: cli.ana, data_pedido: new Date("2026-09-01"), status: "entregue",
    itens: [
      { produto_id: prod.notebook, nome: "Notebook Pro 14", quantidade: 1, preco_unitario: 5499.90 },
      { produto_id: prod.fone, nome: "Fone Bluetooth Wave", quantidade: 1, preco_unitario: 399.00 }
    ],
    pagamento: { metodo: "cartao", parcelas: 10, status: "aprovado" },
    cupom: "BEMVINDO10", valor_total: 5308.11
  },
  {
    cliente_id: cli.bruno, data_pedido: new Date("2026-09-15"), status: "enviado",
    itens: [ { produto_id: prod.livro, nome: "Banco de Dados na Prática", quantidade: 2, preco_unitario: 89.90 } ],
    pagamento: { metodo: "pix", status: "aprovado" },
    valor_total: 179.80
  },
  {
    cliente_id: cli.ana, data_pedido: new Date("2026-10-02"), status: "pendente",
    itens: [ { produto_id: prod.camiseta, nome: "Camiseta Básica Algodão", quantidade: 3, preco_unitario: 59.90 } ],
    pagamento: { metodo: "boleto", status: "aguardando" },
    valor_total: 179.70
  },
  {
    cliente_id: cli.carla, data_pedido: new Date("2026-10-05"), status: "entregue",
    itens: [ { produto_id: prod.fone, nome: "Fone Bluetooth Wave", quantidade: 1, preco_unitario: 399.00 } ],
    pagamento: { metodo: "cartao", parcelas: 1, status: "aprovado" },
    valor_total: 399.00
  }
]);

// -----------------------------------------------------------------------------
// 4. AVALIAÇÕES — Referencing (crescimento ilimitado por produto)
// -----------------------------------------------------------------------------
db.avaliacoes.insertMany([
  { produto_id: prod.notebook, cliente_id: cli.ana,   nota: 5, comentario: "Excelente desempenho", data: new Date("2026-09-10") },
  { produto_id: prod.fone,     cliente_id: cli.ana,   nota: 4, comentario: "Ótimo som, bateria dura muito", data: new Date("2026-09-11") },
  { produto_id: prod.livro,    cliente_id: cli.bruno, nota: 5, comentario: "Muito didático", data: new Date("2026-09-25") },
  { produto_id: prod.fone,     cliente_id: cli.carla, nota: 3, data: new Date("2026-10-08") } // sem comentário
]);

print("\n== Total de documentos ==");
["clientes", "produtos", "pedidos", "avaliacoes"].forEach(c =>
  print(`${c}: ${db.getCollection(c).countDocuments()}`)
);

// -----------------------------------------------------------------------------
// 5. CONSULTAS — find (filtro), sort (ordenação) e projeção
// -----------------------------------------------------------------------------
print("\n== Q1: Produtos ativos com preço até R$ 500, do mais barato ao mais caro ==");
printjson(db.produtos.find(
  { ativo: true, preco: { $lte: 500 } },
  { _id: 0, nome: 1, preco: 1, "categoria.nome": 1 }
).sort({ preco: 1 }).toArray());

print("\n== Q2: Clientes que moram em SP (filtro em array embutido) ==");
printjson(db.clientes.find(
  { "enderecos.uf": "SP" },
  { _id: 0, nome: 1, email: 1 }
).toArray());

print("\n== Q3: Pedidos entregues, mais recentes primeiro ==");
printjson(db.pedidos.find(
  { status: "entregue" },
  { _id: 0, data_pedido: 1, valor_total: 1, "pagamento.metodo": 1 }
).sort({ data_pedido: -1 }).toArray());

print("\n== Q4: Pedidos que contêm o Fone Bluetooth ==");
printjson(db.pedidos.find(
  { "itens.produto_id": prod.fone },
  { _id: 0, cliente_id: 1, data_pedido: 1, status: 1 }
).toArray());

print("\n== Q5: Livros (só existem campos 'autor' nesses documentos) ==");
printjson(db.produtos.find(
  { autor: { $exists: true } },
  { _id: 0, nome: 1, autor: 1, paginas: 1 }
).toArray());

print("\n== Q6: Avaliações de nota >= 4, maior nota primeiro ==");
printjson(db.avaliacoes.find(
  { nota: { $gte: 4 } },
  { _id: 0, nota: 1, comentario: 1 }
).sort({ nota: -1, data: -1 }).toArray());

print("\n== Q7: Referencing na prática — pedidos com os dados do cliente ($lookup) ==");
printjson(db.pedidos.aggregate([
  { $lookup: { from: "clientes", localField: "cliente_id", foreignField: "_id", as: "cliente" } },
  { $unwind: "$cliente" },
  { $project: { _id: 0, cliente: "$cliente.nome", status: 1, valor_total: 1 } },
  { $sort: { valor_total: -1 } }
]).toArray());

// -----------------------------------------------------------------------------
// 6. ÍNDICES + explain()
// -----------------------------------------------------------------------------
function resumoExplain(titulo, cursor) {
  const exp = cursor.explain("executionStats");
  const s = exp.executionStats;
  let stage = exp.queryPlanner.winningPlan;
  const stages = [];
  while (stage) { stages.push(stage.stage + (stage.indexName ? `(${stage.indexName})` : "")); stage = stage.inputStage; }
  print(`${titulo}\n   plano: ${stages.join(" <- ")}\n   docs examinados: ${s.totalDocsExamined} | chaves examinadas: ${s.totalKeysExamined} | retornados: ${s.nReturned}`);
}

const q3 = () => db.pedidos.find({ status: "entregue" }).sort({ data_pedido: -1 });
const q8 = () => db.pedidos.find({ cliente_id: cli.ana });

print("\n== ANTES dos índices ==");
resumoExplain("Pedidos entregues ordenados por data", q3());
resumoExplain("Pedidos de um cliente", q8());

// Índice COMPOSTO: filtro por status + ordenação por data (regra ESR: Equality, Sort, Range)
db.pedidos.createIndex({ status: 1, data_pedido: -1 }, { name: "idx_status_data" });
// Índice SIMPLES: busca dos pedidos de um cliente (chave da referência)
db.pedidos.createIndex({ cliente_id: 1 }, { name: "idx_cliente" });
// Índice de TEXTO: busca de produtos por palavra-chave
db.produtos.createIndex({ nome: "text", descricao: "text" }, { name: "idx_texto_produto", default_language: "portuguese" });
// Índice ÚNICO: impede e-mail duplicado (equivalente ao UNIQUE do PostgreSQL)
db.clientes.createIndex({ email: 1 }, { unique: true, name: "idx_email_unico" });

print("\n== DEPOIS dos índices ==");
resumoExplain("Pedidos entregues ordenados por data", q3());
resumoExplain("Pedidos de um cliente", q8());
resumoExplain("Busca textual por 'fone'", db.produtos.find({ $text: { $search: "fone" } }, { nome: 1 }));

print("\n== Busca textual: 'banco de dados' ==");
printjson(db.produtos.find(
  { $text: { $search: "banco dados" } },
  { _id: 0, nome: 1, score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } }).toArray());
