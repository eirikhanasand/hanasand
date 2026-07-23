#!/bin/sh
set -eu
umask 077

action=${1:-}
user=${POSTGRES_USER:?POSTGRES_USER is required}
database=${POSTGRES_DB:?POSTGRES_DB is required}

inventory_sql() {
  snapshot=${1:-}
  if [ -n "$snapshot" ]; then
    printf "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET TRANSACTION SNAPSHOT '%s';\n" "$snapshot"
  else
    printf "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n"
  fi
  cat <<'SQL'
\pset tuples_only on
\pset format unaligned
\pset fieldsep '\t'
SELECT 'schema', 'table', 'rows', 'content_md5';
SELECT format(
  $query$
  SELECT %L, %L, count(*)::text,
         md5(COALESCE(string_agg(row_md5, '' ORDER BY row_md5), ''))
  FROM (
    SELECT md5(row_to_json(source_row)::text) AS row_md5
    FROM %I.%I AS source_row
  ) AS table_rows
  $query$,
  namespace.nspname,
  relation.relname,
  namespace.nspname,
  relation.relname
)
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE relation.relkind IN ('r', 'p')
  AND namespace.nspname NOT LIKE 'pg\_%' ESCAPE '\'
  AND namespace.nspname <> 'information_schema'
ORDER BY namespace.nspname, relation.relname
\gexec
COMMIT;
SQL
}

object_references_sql() {
  snapshot=${1:?snapshot is required}
  printf "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET TRANSACTION SNAPSHOT '%s';\n" "$snapshot"
  cat <<'SQL'
\pset tuples_only on
\pset format unaligned
\pset fieldsep '\t'
SELECT 'capture_id', 'tenant_id', 'source_id', 'media_type', 'retention_class', 'content_hash',
       'bucket', 'object_key', 'version_id', 'ref_content_hash', 'size_bytes';
SELECT
  id,
  COALESCE(NULLIF(btrim(tenant_id), ''), 'global'),
  source_id,
  media_type,
  retention_class,
  content_hash,
  COALESCE(object_ref->>'bucket', ''),
  COALESCE(object_ref->>'key', ''),
  COALESCE(object_ref->>'versionId', ''),
  COALESCE(object_ref->>'sha256', ''),
  COALESCE(object_ref->>'sizeBytes', '')
FROM threat_intel.captures
WHERE object_ref IS NOT NULL
   OR storage_kind IN ('external_object', 'object_ref')
ORDER BY id;
COMMIT;
SQL
}

case "$action" in
  inventory)
    inventory_sql | psql -X -q -U "$user" -d "$database" -v ON_ERROR_STOP=1
    ;;
  backup)
    work=$(mktemp -d /tmp/hanasand-ti-backup.XXXXXX)
    fifo="$work/snapshot-control"
    snapshot_file="$work/snapshot"
    holder_error="$work/snapshot-holder.error"
    holder_pid=
    control_open=false
    cleanup() {
      exit_code=$?
      trap - EXIT INT TERM
      if [ "$control_open" = true ]; then
        printf 'ROLLBACK;\n\\q\n' >&3 || true
        exec 3>&-
      fi
      [ -z "$holder_pid" ] || wait "$holder_pid" || true
      rm -rf -- "$work" || true
      exit "$exit_code"
    }
    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM

    mkfifo "$fifo"
    psql -X -A -t -U "$user" -d "$database" -v ON_ERROR_STOP=1 < "$fifo" > /dev/null 2> "$holder_error" &
    holder_pid=$!
    exec 3> "$fifo"
    control_open=true
    printf '\\set ON_ERROR_STOP on\nBEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n\\o %s\nSELECT pg_export_snapshot();\n\\o /dev/null\n' "$snapshot_file" >&3

    attempts=0
    while [ ! -s "$snapshot_file" ]; do
      attempts=$((attempts + 1))
      if ! kill -0 "$holder_pid" 2>/dev/null; then
        cat "$holder_error" >&2
        exit 1
      fi
      [ "$attempts" -lt 30 ] || { echo "timed out exporting PostgreSQL backup snapshot" >&2; exit 1; }
      sleep 1
    done
    snapshot=$(sed -n '1p' "$snapshot_file")

    pg_dump \
      -U "$user" \
      -d "$database" \
      --format=custom \
      --no-owner \
      --no-privileges \
      --snapshot="$snapshot" \
      --file="$work/database.dump"
    inventory_sql "$snapshot" | psql -X -q -U "$user" -d "$database" -v ON_ERROR_STOP=1 > "$work/DATABASE-INVENTORY.tsv"
    object_references_sql "$snapshot" | psql -X -q -U "$user" -d "$database" -v ON_ERROR_STOP=1 > "$work/OBJECT-REFERENCES.tsv"
    printf '%s\n' "$database" > "$work/SOURCE-DATABASE"

    printf 'ROLLBACK;\n\\q\n' >&3
    exec 3>&-
    control_open=false
    wait "$holder_pid"
    holder_pid=

    tar -C "$work" -cf - database.dump DATABASE-INVENTORY.tsv OBJECT-REFERENCES.tsv SOURCE-DATABASE
    ;;
  *)
    echo "usage: $0 <backup|inventory>" >&2
    exit 2
    ;;
esac
