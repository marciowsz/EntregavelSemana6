#!/usr/bin/env bash
# =============================================================================
# 10_teste_restauracao.sh — "Teste unitário" do backup
# Restaura o dump mais recente em um banco de TESTE e compara a contagem
# de registros de cada tabela com o banco original.
# =============================================================================

set -euo pipefail

DB_NAME="${DB_NAME:-ecommerce}"
TEST_DB="${TEST_DB:-ecommerce_restore_test}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/postgres}"

TABLES=(clientes enderecos categorias produtos estoque cupons pedidos itens_pedido pagamentos avaliacoes)
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tA)

# 1. Localiza o backup mais recente (ou usa o informado como argumento)
BACKUP_FILE="${1:-$(ls -1t "$BACKUP_DIR/${DB_NAME}"_*.dump 2>/dev/null | head -n 1)}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "ERRO: nenhum backup encontrado em $BACKUP_DIR"; exit 1
fi
echo ">> Backup utilizado: $BACKUP_FILE"

# 2. Recria o banco de teste do zero
dropdb   -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$TEST_DB"
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB"

# 3. Restaura (--no-owner evita erro se os papéis não existirem no destino)
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
           -d "$TEST_DB" --no-owner --exit-on-error "$BACKUP_FILE"
echo ">> Restauração concluída em '$TEST_DB'"

# 4. Compara contagem de registros
printf "\n%-15s %10s %10s %8s\n" "TABELA" "ORIGINAL" "RESTAURADO" "STATUS"
printf "%-15s %10s %10s %8s\n"   "---------------" "--------" "----------" "------"

FALHAS=0
for t in "${TABLES[@]}"; do
    orig="$("${PSQL[@]}" -d "$DB_NAME" -c "SELECT COUNT(*) FROM $t;")"
    rest="$("${PSQL[@]}" -d "$TEST_DB" -c "SELECT COUNT(*) FROM $t;")"
    if [ "$orig" = "$rest" ]; then status="OK"; else status="FALHA"; FALHAS=$((FALHAS+1)); fi
    printf "%-15s %10s %10s %8s\n" "$t" "$orig" "$rest" "$status"
done

# 5. Verificação extra de integridade: soma dos valores de pedidos
soma_orig="$("${PSQL[@]}" -d "$DB_NAME" -c "SELECT COALESCE(SUM(valor_total),0) FROM pedidos;")"
soma_rest="$("${PSQL[@]}" -d "$TEST_DB" -c "SELECT COALESCE(SUM(valor_total),0) FROM pedidos;")"
echo -e "\nSoma de pedidos.valor_total -> original: $soma_orig | restaurado: $soma_rest"
[ "$soma_orig" = "$soma_rest" ] || FALHAS=$((FALHAS+1))

if [ "$FALHAS" -eq 0 ]; then
    echo -e "\n✅ Backup ÍNTEGRO: todas as verificações passaram."
else
    echo -e "\n❌ $FALHAS verificação(ões) falharam. NÃO confie neste backup."; exit 1
fi
