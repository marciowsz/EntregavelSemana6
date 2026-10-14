#!/usr/bin/env bash
# =============================================================================
# 08_backup.sh — Backup lógico do banco E-commerce (PostgreSQL)
# Formato customizado (-Fc), nome com data, tratamento de erros e
# retenção de 30 dias.
#
# Autenticação: use o arquivo ~/.pgpass (chmod 600) para não expor senha:
#   localhost:5432:ecommerce:postgres:SUA_SENHA
# =============================================================================

set -euo pipefail

# ---------- Configurações (podem ser sobrescritas por variáveis de ambiente) --
DB_NAME="${DB_NAME:-ecommerce}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LOG_FILE="${LOG_FILE:-$BACKUP_DIR/backup.log}"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

# ---------- Funções auxiliares ------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

on_error() {
    log "ERRO: backup falhou na linha $1. Removendo arquivo incompleto."
    rm -f "$BACKUP_FILE"
    exit 1
}
trap 'on_error $LINENO' ERR

# ---------- Pré-verificações --------------------------------------------------
mkdir -p "$BACKUP_DIR"

for cmd in pg_dump pg_restore pg_isready; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log "ERRO: comando '$cmd' não encontrado. Instale o postgresql-client."
        exit 1
    fi
done

if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
    log "ERRO: servidor PostgreSQL em $DB_HOST:$DB_PORT não está respondendo."
    exit 1
fi

# ---------- Backup ------------------------------------------------------------
log "Iniciando backup do banco '$DB_NAME' -> $BACKUP_FILE"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -Fc -Z 6 \
        -f "$BACKUP_FILE" \
        "$DB_NAME"

# ---------- Validação do arquivo gerado ---------------------------------------
if [ ! -s "$BACKUP_FILE" ]; then
    log "ERRO: arquivo de backup vazio ou inexistente."
    exit 1
fi

# Lê o índice do dump: se o arquivo estiver corrompido, pg_restore falha
pg_restore --list "$BACKUP_FILE" >/dev/null

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
log "Backup concluído com sucesso ($SIZE)."

# ---------- Retenção: remove backups com mais de N dias -----------------------
REMOVED="$(find "$BACKUP_DIR" -name "${DB_NAME}_*.dump" -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
log "Limpeza: $REMOVED backup(s) com mais de $RETENTION_DAYS dias removido(s)."

# ---------- Cópia externa (regra 3-2-1) — opcional -----------------------------
# Descomente a linha correspondente ao destino externo usado pela equipe:
# aws s3 cp "$BACKUP_FILE" "s3://meu-bucket/postgres/"
# rclone copy "$BACKUP_FILE" "gdrive:backups/postgres/"

log "Rotina finalizada."
exit 0
