# Projeto de Banco de Dados E-Commerce — Sprints 5 e 6

Este repositório contém o modelo relacional e os scripts físicos para a simulação de um banco de dados completo de e-commerce utilizando **PostgreSQL**, além das rotinas de **backup e restauração** e de uma **introdução à modelagem NoSQL com MongoDB** (Sprint 6).

## Estrutura do repositório

| Arquivo | Conteúdo | Sprint |
|---|---|---|
| `01_ddl.sql` | Criação das tabelas e restrições | 5 |
| `02_inserts.sql` | Carga de dados (15+ registros por tabela) | 5 |
| `03_indices.sql` | Índices justificados | 5 |
| `04_consultas.sql` | Consultas com JOIN, GROUP BY e subconsultas | 5 |
| `05_transacoes.sql` | Transações com BEGIN/COMMIT/ROLLBACK | 5 |
| `06_permissoes.sql` | Usuários e papéis com GRANT/REVOKE | 5 |
| `07_explain.sql` | Análise com EXPLAIN ANALYZE | 5 |
| `08_backup.sh` | Script de backup automatizado (`pg_dump -Fc`) | 6 |
| `09_crontab.txt` | Agendamento diário do backup | 6 |
| `10_teste_restauracao.sh` | Restauração em banco de teste e validação | 6 |
| `11_mongodb.js` | Collections, documentos, consultas e índices no MongoDB | 6 |

---

## 1. Domínio e Modelo Lógico

O sistema simula uma loja virtual: clientes se cadastram com um ou mais endereços, navegam por produtos organizados em categorias, fazem pedidos com vários itens, aplicam cupons de desconto, pagam e avaliam os produtos comprados.

O banco relacional é composto por **10 tabelas**:
`clientes`, `enderecos`, `categorias`, `produtos`, `estoque`, `cupons`, `pedidos`, `itens_pedido`, `pagamentos`, `avaliacoes`.

Principais relacionamentos: um cliente possui vários endereços e vários pedidos; um pedido possui vários itens e um pagamento; cada item referencia um produto; cada produto pertence a uma categoria e possui um registro de estoque; avaliações ligam clientes a produtos.

## 2. Estratégia de Indexação (PostgreSQL)

Índices foram aplicados estritamente em colunas de Chaves Estrangeiras (`cliente_id`, `produto_id`, `categoria_id`) e em colunas amplamente utilizadas em filtros combinados e ordenação (`status`, `data_pedido`), evitando *overhead* excessivo em operações de escrita.

## 3. Controle de Transações

Garantia de propriedades ACID por meio de `BEGIN`, `COMMIT`, `RETURNING` e `SAVEPOINT`. Exemplos incluem a atomicidade no cadastro de pedidos junto à baixa em estoque e o registro seguro de pagamentos.

## 4. Análise de Performance (`EXPLAIN ANALYZE`)

A execução de planos de consulta confirmou a otimização de `Seq Scan` para `Index Scan` e `Bitmap Index Scan` em filtros de status e relacionamentos frequentes.

## 5. Segurança e Controle de Acesso (RBAC)

Princípio do Menor Privilégio via papéis `role_admin` e `role_gerente_vendas`, restringindo explicitamente permissões destrutivas como `DELETE` em tabelas sensíveis.

---

## 6. Rotina de Backup (Sprint 6)

### 6.1 O script `08_backup.sh`

O script realiza o backup lógico do banco com `pg_dump` no **formato customizado (`-Fc`)**, que é compactado e permite restauração seletiva (por tabela ou objeto) com `pg_restore`.

| Etapa | Como é feita |
|---|---|
| Nome com data | `ecommerce_AAAA-MM-DD_HH-MM-SS.dump` |
| Tratamento de erros | `set -euo pipefail` + `trap` que registra a falha no log e apaga o arquivo incompleto |
| Pré-verificações | Confere se `pg_dump`/`pg_restore` existem e se o servidor responde (`pg_isready`) |
| Validação | Verifica se o arquivo não está vazio e lê seu índice com `pg_restore --list` |
| Retenção | `find -mtime +30 -delete` remove backups com mais de 30 dias |
| Log | Cada execução é registrada em `backup.log` |

A senha não fica no script: é lida do arquivo `~/.pgpass` (permissão `600`).

```bash
chmod +x 08_backup.sh
./08_backup.sh
```

### 6.2 Agendamento com cron

Execução diária às 2h da manhã (ver `09_crontab.txt`):

```
0 2 * * * /home/USUARIO/projeto-ecommerce/08_backup.sh >> /home/USUARIO/backups/postgres/cron.log 2>&1
```

Os campos são, em ordem: minuto (`0`), hora (`2`), dia do mês, mês e dia da semana (`*` = todos).

### 6.3 Regra 3-2-1

A regra 3-2-1 diz que devemos ter **3 cópias** dos dados, em **2 mídias diferentes**, sendo **1 fora do local** (off-site). No projeto ela se aplica assim:

| Cópia | Onde fica |
|---|---|
| 1ª (produção) | O próprio banco PostgreSQL |
| 2ª (mídia local diferente) | Arquivos `.dump` em `~/backups/postgres` (idealmente outro disco) |
| 3ª (off-site) | Envio para nuvem (S3, Google Drive) — linhas `aws s3 cp` / `rclone copy` prontas no final do script |

### 6.4 Teste de Restauração

> "Backup que não foi testado não é backup."

O script `10_teste_restauracao.sh` funciona como o "teste unitário" do backup:

1. Localiza o `.dump` mais recente.
2. Recria um banco de teste vazio (`ecommerce_restore_test`) com `dropdb`/`createdb`.
3. Restaura com `pg_restore --no-owner --exit-on-error`.
4. Compara a contagem de registros (`COUNT(*)`) de cada uma das 10 tabelas entre o banco original e o restaurado.
5. Compara a soma de `pedidos.valor_total` como verificação extra de integridade.

Restauração manual equivalente:

```bash
createdb ecommerce_restore_test
pg_restore -d ecommerce_restore_test --no-owner ~/backups/postgres/ecommerce_2026-10-14_02-00-00.dump
psql -d ecommerce_restore_test -c "SELECT COUNT(*) FROM pedidos;"
```

Resultado obtido:

```
TABELA            ORIGINAL RESTAURADO   STATUS
---------------   -------- ----------   ------
clientes                15         15       OK
enderecos               15         15       OK
categorias              15         15       OK
produtos                15         15       OK
estoque                 15         15       OK
cupons                  15         15       OK
pedidos                 15         15       OK
itens_pedido            15         15       OK
pagamentos              15         15       OK
avaliacoes              15         15       OK

✅ Backup ÍNTEGRO: todas as verificações passaram.
```

---

## 7. Introdução ao MongoDB (Sprint 6)

Executar com `mongosh 11_mongodb.js`. O banco `ecommerce` no MongoDB contém **4 collections** e **16 documentos**.

| Collection | Documentos | Estratégia |
|---|---|---|
| `clientes` | 3 | Endereços **embutidos** |
| `produtos` | 5 | Categoria **embutida**; atributos variáveis por tipo de produto |
| `pedidos` | 4 | Itens e pagamento **embutidos**; cliente **referenciado** |
| `avaliacoes` | 4 | Produto e cliente **referenciados** |

### 7.1 Embedding vs Referencing — justificativas

A regra adotada foi **modelar pelo padrão de acesso**: o que é lido junto fica junto; o que é lido separado ou cresce sem limite é referenciado.

| Decisão | Abordagem | Justificativa |
|---|---|---|
| Endereços dentro de `clientes` | Embedding | Sempre são exibidos junto com o cliente (checkout, perfil), são poucos por cliente e não existem sem ele. No PostgreSQL isso exigia a tabela `enderecos` + JOIN. |
| Itens e pagamento dentro de `pedidos` | Embedding | Um pedido é sempre lido inteiro. Os itens guardam um *snapshot* do nome e do preço no momento da compra, então alterar o preço do produto não altera pedidos antigos. Substitui `itens_pedido` e `pagamentos`. |
| Categoria dentro de `produtos` | Embedding | Leitura muito mais frequente que escrita; só nome e slug são duplicados. |
| `cliente_id` em `pedidos` | Referencing | Um cliente pode ter um número ilimitado de pedidos; embuti-los no cliente faria o documento crescer sem limite (o limite é 16 MB) e os pedidos são consultados de forma independente (painel de vendas, por status). |
| `avaliacoes` em collection própria | Referencing | Um produto popular pode ter milhares de avaliações (crescimento indefinido), e elas são carregadas paginadas, separadas da página do produto. |

### 7.2 Flexibilidade de esquema

Na collection `produtos`, cada documento tem apenas os campos que fazem sentido para ele: o notebook tem `especificacoes.ram_gb`, o livro tem `autor` e `isbn`, a camiseta tem um array `variacoes` com tamanho e cor. No PostgreSQL isso exigiria colunas nulas, uma coluna `JSONB` ou tabelas extras por tipo de produto. Da mesma forma, só uma cliente tem `telefone` e uma avaliação não tem `comentario`.

### 7.3 Consultas (find, sort e projeção)

| # | Consulta | Recursos |
|---|---|---|
| Q1 | Produtos ativos até R$ 500, do mais barato ao mais caro | filtro `$lte`, `sort`, projeção |
| Q2 | Clientes com endereço em SP | filtro em array embutido |
| Q3 | Pedidos entregues, mais recentes primeiro | filtro, `sort` desc, projeção de subcampo |
| Q4 | Pedidos que contêm um produto | filtro por `itens.produto_id` |
| Q5 | Produtos que possuem `autor` (livros) | `$exists` — aproveita o esquema flexível |
| Q6 | Avaliações com nota ≥ 4 | `$gte`, `sort` por dois campos |
| Q7 | Pedidos com nome do cliente | `$lookup` (equivalente ao JOIN) |

### 7.4 Índices e `explain()`

| Índice | Tipo | Finalidade |
|---|---|---|
| `idx_status_data` `{status: 1, data_pedido: -1}` | Composto | Filtrar por status e ordenar por data (segue a regra ESR: igualdade, depois ordenação) |
| `idx_cliente` `{cliente_id: 1}` | Simples | Buscar os pedidos de um cliente (campo da referência) |
| `idx_texto_produto` `{nome, descricao}` | Texto | Busca por palavra-chave no catálogo, em português |
| `idx_email_unico` `{email: 1}` | Único | Impedir e-mails duplicados (equivalente ao `UNIQUE`) |

O script imprime o resumo de `explain("executionStats")` antes e depois dos índices:

| Consulta | Antes | Depois |
|---|---|---|
| Pedidos entregues ordenados por data | `COLLSCAN` + `SORT` em memória; examina todos os documentos | `IXSCAN (idx_status_data)`; examina só os entregues e já vem ordenado, sem etapa de `SORT` |
| Pedidos de um cliente | `COLLSCAN` | `IXSCAN (idx_cliente)`; documentos examinados = documentos retornados |
| Busca textual | Não é possível sem índice de texto | `TEXT_MATCH` / `IXSCAN (idx_texto_produto)` |

Com poucos documentos a diferença de tempo é pequena; o indicador importante é `totalDocsExamined` cair para o mesmo valor de `nReturned`, que é o que garante desempenho conforme a base cresce. É a mesma ideia da troca de `Seq Scan` por `Index Scan` vista no `EXPLAIN ANALYZE` da Sprint 5.

---

## 8. Comparação Técnica: PostgreSQL vs MongoDB no E-commerce

| Critério | PostgreSQL | MongoDB |
|---|---|---|
| Modelo | Tabelas normalizadas, esquema rígido | Documentos JSON, esquema flexível |
| Integridade | FK, CHECK, UNIQUE garantidas pelo banco | Validação opcional; referências não são verificadas pelo banco |
| Transações | ACID nativo e maduro, entre várias tabelas | Atômico por documento; multi-documento existe, mas com mais custo |
| Relacionamentos | JOINs eficientes | `$lookup` existe, mas o ideal é embutir |
| Escala | Principalmente vertical | Horizontal nativa (*sharding*) |
| Consultas analíticas | SQL completo, GROUP BY, window functions | Aggregation pipeline |

**Onde o PostgreSQL é mais adequado no nosso domínio:** pagamentos, baixa de estoque e aplicação de cupons. Essas operações exigem que várias tabelas mudem juntas ou nada mude (a transação de pedido + estoque da Sprint 5) e que o banco impeça estados inválidos, como estoque negativo (`CHECK`) ou pedido de cliente inexistente (FK). Relatórios financeiros com JOINs e agregações também ficam mais simples em SQL.

**Onde o MongoDB se sobressai no nosso domínio:** catálogo de produtos, em que cada categoria tem atributos diferentes e novos tipos de produto surgem sem precisar de `ALTER TABLE`; leitura do pedido completo em uma única consulta; avaliações e históricos de navegação, que têm alto volume de escrita e crescem rapidamente; e busca textual no catálogo.

**Conclusão:** em um e-commerce real, a melhor solução é **persistência poliglota** — o núcleo transacional (pedidos, pagamentos, estoque) no PostgreSQL e o catálogo, avaliações e dados de sessão no MongoDB, cada tecnologia usada onde suas garantias fazem mais sentido.
