#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for command in supabase psql jq; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Erro: comando obrigatório não encontrado: $command" >&2
    exit 1
  fi
done

JOURNAL="drizzle/migrations/meta/_journal.json"
MIGRATIONS_DIR="drizzle/migrations"
TEST_DIR="supabase/tests"

if [[ ! -f "$JOURNAL" ]]; then
  echo "Erro: journal do Drizzle não encontrado em $JOURNAL" >&2
  exit 1
fi

if [[ ! -d "$TEST_DIR" ]]; then
  echo "Erro: diretório de testes pgTAP não encontrado em $TEST_DIR" >&2
  exit 1
fi

# Keep one migration source of truth. If SQL migrations are later added to
# Supabase's default folder, stop instead of silently applying two histories.
if compgen -G "supabase/migrations/*.sql" > /dev/null; then
  echo "Erro: foram encontrados SQLs em supabase/migrations. Mantenha as migrações no Drizzle journal ou planeje uma transição explícita." >&2
  exit 1
fi

# This script is intentionally restricted to the local Supabase stack.
# Never point this test harness at a hosted/production database.
DB_URL="${LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$DB_URL" in
  *127.0.0.1:54322*|*localhost:54322*) ;;
  *)
    echo "Erro: LOCAL_DATABASE_URL deve apontar para o Supabase local na porta 54322." >&2
    exit 1
    ;;
esac

echo "==> Iniciando Supabase local"
supabase start

echo "==> Limpando e recriando SOMENTE o banco local descartável"
supabase db reset --local

echo "==> Preparando pgTAP"
psql "$DB_URL" --set ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SQL

echo "==> Aplicando migrações Drizzle na ordem do journal"
mapfile -t migration_tags < <(jq -r '.entries | sort_by(.idx)[] | .tag' "$JOURNAL")

if [[ ${#migration_tags[@]} -eq 0 ]]; then
  echo "Erro: nenhuma migração foi encontrada no journal do Drizzle." >&2
  exit 1
fi

for tag in "${migration_tags[@]}"; do
  migration_file="$MIGRATIONS_DIR/$tag.sql"
  if [[ ! -f "$migration_file" ]]; then
    echo "Erro: journal referencia arquivo inexistente: $migration_file" >&2
    exit 1
  fi

  echo "    -> $migration_file"
  psql "$DB_URL" --set ON_ERROR_STOP=1 --file "$migration_file"
done

echo "==> Executando testes pgTAP"
supabase test db --local

echo "==> Testes SQL concluídos."
