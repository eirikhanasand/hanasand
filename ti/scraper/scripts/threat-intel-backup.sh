#!/bin/sh
set -eu
umask 077

action=${1:-}
archive=${2:-}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
postgres_helper="$script_dir/threat-intel-postgres.sh"
dump="$archive/database.dump"
database_inventory="$archive/DATABASE-INVENTORY.tsv"
object_references="$archive/OBJECT-REFERENCES.tsv"
object_ledger="$archive/OBJECT-LEDGER.tsv"
objects="$archive/evidence.tar.gz"
evidence_inventory="$archive/EVIDENCE-INVENTORY.tsv"
manifest="$archive/BACKUP-MANIFEST"
checksums="$archive/SHA256SUMS"
postgres_image=${TI_RESTORE_POSTGRES_IMAGE:-postgres:15}
scraper_image_ref=${TI_RESTORE_SCRAPER_IMAGE:-hanasand_ti_scraper}
scraper_image=
repo_root=$(CDPATH= cd -- "$script_dir/../../.." && pwd)

usage() {
  echo "usage: $0 <backup|verify|drill> <archive-directory>" >&2
  exit 2
}

[ -n "$action" ] && [ -n "$archive" ] || usage

compose() { docker compose "$@"; }
resolve_scraper_image() { docker image inspect "$scraper_image_ref" --format '{{.Id}}'; }

inspect_evidence_archive() (
  set -eu
  evidence_archive=${1:-$objects}
  inventory_output=${2:?inventory output is required}
  ledger_output=${3:?object ledger output is required}
  evidence_tmp=$(mktemp -d "${TMPDIR:-/tmp}/hanasand-ti-evidence.XXXXXX")
  listing=$(mktemp "${TMPDIR:-/tmp}/hanasand-ti-evidence-list.XXXXXX")
  cleanup_inspection() {
    exit_code=$?
    trap - EXIT INT TERM
    rm -rf -- "$evidence_tmp" "$listing" || true
    exit "$exit_code"
  }
  trap cleanup_inspection EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  tar -tzf "$evidence_archive" > "$listing"
  awk '
    {
      path = $0
      sub(/^\.\//, "", path)
      if (path ~ /^\//) exit 1
      count = split(path, parts, "/")
      for (part_index = 1; part_index <= count; part_index += 1) if (parts[part_index] == "..") exit 1
    }
  ' "$listing" || { echo "evidence archive contains an unsafe path" >&2; exit 1; }
  tar -tvzf "$evidence_archive" | awk '
    substr($0, 1, 1) != "d" && substr($0, 1, 1) != "-" { exit 1 }
  ' || {
    echo "evidence archive contains a symlink or non-regular entry" >&2
    exit 1
  }
  if ! tar -C "$evidence_tmp" -xzf "$evidence_archive"; then
    exit 1
  fi
  [ -z "$(find "$evidence_tmp" ! -type d ! -type f -print -quit)" ] || {
    echo "evidence archive contains a symlink or non-regular entry" >&2
    exit 1
  }
  {
    printf 'path\tsha256\n'
    evidence_files=$(mktemp "${TMPDIR:-/tmp}/hanasand-ti-evidence-files.XXXXXX")
    LC_ALL=C find "$evidence_tmp" -type f -print0 | LC_ALL=C sort -z > "$evidence_files"
    if [ -s "$evidence_files" ]; then
      xargs -0 shasum -a 256 < "$evidence_files" | while read -r hash file; do
        relative=${file#"$evidence_tmp"/}
        printf '%s\t%s\n' "$relative" "$hash"
      done
    fi
    rm -f -- "$evidence_files"
  } > "$inventory_output"

  references_path=$(CDPATH= cd -- "$(dirname -- "$object_references")" && pwd)/$(basename -- "$object_references")
  docker run --rm \
    -v "$evidence_tmp:/evidence:ro" \
    -v "$references_path:/backup/OBJECT-REFERENCES.tsv:ro" \
    "$scraper_image" \
    bun scripts/verify-restored-database.ts ledger /backup/OBJECT-REFERENCES.tsv /evidence > "$ledger_output"
)

verify() (
  set -eu
  for file in "$dump" "$database_inventory" "$object_references" "$object_ledger" "$objects" "$evidence_inventory" "$manifest" "$checksums"; do
    [ -f "$file" ] || { echo "incomplete threat-intelligence backup: missing $file" >&2; exit 1; }
    [ ! -L "$file" ] || { echo "incomplete threat-intelligence backup: non-regular artifact" >&2; exit 1; }
  done

  (cd "$archive" && shasum -a 256 -c SHA256SUMS)

  verify_tmp=$(mktemp -d "${TMPDIR:-/tmp}/hanasand-ti-verify.XXXXXX")
  cleanup_verify() {
    exit_code=$?
    trap - EXIT INT TERM
    rm -rf -- "$verify_tmp" || true
    exit "$exit_code"
  }
  trap cleanup_verify EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  docker run --rm -i -v "$dump:/backup/database.dump:ro" "$postgres_image" pg_restore --list /backup/database.dump > "$verify_tmp/archive.list"
  awk '$4 == "TABLE" && $5 != "ATTACH" && $5 != "DATA" { print $5 "." $6 }' "$verify_tmp/archive.list" | LC_ALL=C sort > "$verify_tmp/archive-tables"
  awk -F '\t' 'NR > 1 { print $1 "." $2 }' "$database_inventory" | LC_ALL=C sort > "$verify_tmp/inventory-tables"
  if ! cmp -s "$verify_tmp/archive-tables" "$verify_tmp/inventory-tables"; then
    diff -u "$verify_tmp/archive-tables" "$verify_tmp/inventory-tables" >&2 || true
    echo "database inventory does not match every table in the backup archive" >&2
    exit 1
  fi
  grep -Fx 'threat_intel.schema_migrations' "$verify_tmp/archive-tables" >/dev/null || {
    echo "backup is missing the threat_intel migration ledger" >&2
    exit 1
  }

  inspect_evidence_archive "$objects" "$verify_tmp/evidence-inventory" "$verify_tmp/object-ledger"
  cmp -s "$evidence_inventory" "$verify_tmp/evidence-inventory" || {
    diff -u "$evidence_inventory" "$verify_tmp/evidence-inventory" >&2 || true
    echo "evidence inventory does not match the evidence archive" >&2
    exit 1
  }
  cmp -s "$object_ledger" "$verify_tmp/object-ledger" || {
    echo "DB-bound object ledger does not match the evidence archive" >&2
    exit 1
  }
  tar -tzf "$objects" >/dev/null

  if [ -e "$archive/RESTORE-LATEST" ]; then
    [ -f "$archive/RESTORE-LATEST" ] && [ ! -L "$archive/RESTORE-LATEST" ] || {
      echo "invalid restore receipt pointer" >&2
      exit 1
    }
    [ "$(wc -l < "$archive/RESTORE-LATEST" | tr -d ' ')" -eq 1 ] || {
      echo "invalid restore receipt pointer" >&2
      exit 1
    }
    receipt_id=$(sed -n '1p' "$archive/RESTORE-LATEST")
    case "$receipt_id" in
      RESTORE-RECEIPT-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z-[0-9]*) ;;
      *) echo "invalid restore receipt pointer" >&2; exit 1 ;;
    esac
    receipt_suffix=${receipt_id##*-}
    case "$receipt_suffix" in
      ''|*[!0-9]*) echo "invalid restore receipt pointer" >&2; exit 1 ;;
    esac
    receipt="$archive/$receipt_id"
    [ -d "$receipt" ] && [ ! -L "$receipt" ] || { echo "missing restore receipt" >&2; exit 1; }
    for file in RESTORE-INVENTORY.tsv RESTORE-EVIDENCE-INVENTORY.tsv RESTORE-OBJECT-LEDGER.tsv APPLICATION-READ-PROOF.json RESTORE-REPORT RESTORE-SHA256SUMS; do
      [ -f "$receipt/$file" ] && [ ! -L "$receipt/$file" ] || { echo "incomplete restore receipt" >&2; exit 1; }
    done
    (cd "$receipt" && shasum -a 256 -c RESTORE-SHA256SUMS)
  fi
)

case "$action" in
  backup)
    mkdir -p "$archive"
    chmod 700 "$archive"
    [ ! -e "$dump" ] || { echo "backup archive already contains database.dump: $archive" >&2; exit 1; }
    backup_image_id=$(resolve_scraper_image)
    scraper_image=$backup_image_id

    database_bundle="$archive/.database-bundle.$$"
    if ! compose exec -T postgres sh -s -- backup < "$postgres_helper" > "$database_bundle"; then
      rm -f -- "$database_bundle"
      exit 1
    fi
    tar -C "$archive" -xf "$database_bundle"
    rm -f -- "$database_bundle"

    compose exec -T ti-scraper tar -C /var/lib/ti-scraper/evidence -czf - . > "$objects"
    inspect_evidence_archive "$objects" "$evidence_inventory" "$object_ledger"

    database_schemas=$(awk -F '\t' 'NR > 1 { seen[$1] = 1 } END { for (schema in seen) count += 1; print count + 0 }' "$database_inventory")
    database_tables=$(awk 'NR > 1 { count += 1 } END { print count + 0 }' "$database_inventory")
    database_rows=$(awk -F '\t' 'NR > 1 { rows += $3 } END { printf "%.0f\n", rows + 0 }' "$database_inventory")
    database_hash=$(shasum -a 256 "$database_inventory" | awk '{print $1}')
    evidence_files=$(awk 'NR > 1 { count += 1 } END { print count + 0 }' "$evidence_inventory")
    evidence_hash=$(shasum -a 256 "$evidence_inventory" | awk '{print $1}')
    object_count=$(awk 'NR > 1 { count += 1 } END { print count + 0 }' "$object_ledger")
    object_hash=$(shasum -a 256 "$object_ledger" | awk '{print $1}')
    object_retention_differences=$(awk -F '\t' 'NR > 1 && $5 != $14 { count += 1 } END { print count + 0 }' "$object_ledger")
    release_commit=$(git -C "$repo_root" rev-parse HEAD)
    source_database=$(sed -n '1p' "$archive/SOURCE-DATABASE")

    {
      printf 'format=hanasand.threat_intel_backup.v3\n'
      printf 'created_at=%s\n' "$(date -u +%FT%TZ)"
      printf 'release_commit=%s\n' "$release_commit"
      printf 'scraper_image_id=%s\n' "$backup_image_id"
      printf 'source_database=%s\n' "$source_database"
      printf 'database_scope=all_non_system_schemas\n'
      printf 'database_schemas=%s\n' "$database_schemas"
      printf 'database_tables=%s\n' "$database_tables"
      printf 'database_rows=%s\n' "$database_rows"
      printf 'database_inventory_sha256=%s\n' "$database_hash"
      printf 'evidence_files=%s\n' "$evidence_files"
      printf 'evidence_inventory_sha256=%s\n' "$evidence_hash"
      printf 'referenced_objects=%s\n' "$object_count"
      printf 'object_ledger_sha256=%s\n' "$object_hash"
      printf 'object_retention_differences=%s\n' "$object_retention_differences"
      printf 'restore_policy=isolated_ephemeral_postgresql_only\n'
    } > "$manifest"
    rm -f -- "$archive/SOURCE-DATABASE"

    (
      cd "$archive"
      shasum -a 256 database.dump DATABASE-INVENTORY.tsv OBJECT-REFERENCES.tsv OBJECT-LEDGER.tsv \
        evidence.tar.gz EVIDENCE-INVENTORY.tsv BACKUP-MANIFEST > SHA256SUMS
    )
    verify
    ;;
  verify)
    scraper_image=$(resolve_scraper_image)
    verify
    ;;
  drill)
    drill_container="hanasand-ti-restore-$(date -u +%Y%m%d%H%M%S)-$$"
    drill_network="$drill_container-network"
    drill_evidence="$drill_container-evidence"
    drill_user=ti_restore
    drill_database=ti_restore
    drill_password="ti_restore_$$_$(date -u +%s)"
    drill_tmpfs=${TI_RESTORE_TMPFS_SIZE:-8g}
    archive_parent=$(CDPATH= cd -- "$(dirname -- "$archive")" && pwd)
    receipt_stage=
    pointer_tmp=
    receipt_phase=initialize
    receipt_reason=command_failed
    verifier_commit=unavailable
    scraper_image_id=unavailable

    write_last_attempt() {
      attempt_status=$1
      attempt_exit_code=$2
      attempt_reason=$3
      attempt_tmp=$(mktemp "$archive_parent/.RESTORE-LAST-ATTEMPT.XXXXXX")
      {
        printf 'format=hanasand.threat_intel_restore_attempt.v1\n'
        printf 'status=%s\n' "$attempt_status"
        printf 'completed_at=%s\n' "$(date -u +%FT%TZ)"
        printf 'exit_code=%s\n' "$attempt_exit_code"
        printf 'phase=%s\n' "$receipt_phase"
        printf 'reason=%s\n' "$attempt_reason"
        printf 'verifier_commit=%s\n' "$verifier_commit"
        printf 'scraper_image_id=%s\n' "$scraper_image_id"
      } > "$attempt_tmp"
      mv "$attempt_tmp" "$archive/RESTORE-LAST-ATTEMPT"
    }
    cleanup_resources() {
      docker rm -f "$drill_container" >/dev/null 2>&1 || true
      docker network rm "$drill_network" >/dev/null 2>&1 || true
      docker volume rm "$drill_evidence" >/dev/null 2>&1 || true
    }
    cleanup_drill() {
      exit_code=$?
      trap - EXIT INT TERM
      cleanup_resources
      [ -z "$receipt_stage" ] || rm -rf -- "$receipt_stage" || true
      [ -z "$pointer_tmp" ] || rm -f -- "$pointer_tmp" || true
      if [ "$exit_code" -ne 0 ]; then
        write_last_attempt failed "$exit_code" "$receipt_reason" || {
          printf '%s status=failed phase=receipt reason=status_write_failed exit_code=%s\n' "$(date -u +%FT%TZ)" "$exit_code" >&2
        }
      fi
      exit "$exit_code"
    }
    trap cleanup_drill EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM

    verifier_commit=$(git -C "$repo_root" rev-parse HEAD)
    scraper_image_id=$(resolve_scraper_image)
    scraper_image=$scraper_image_id
    receipt_phase=verify
    verify
    receipt_stage=$(mktemp -d "$archive_parent/.hanasand-ti-restore-receipt.XXXXXX")

    receipt_phase=database_restore
    docker network create "$drill_network" >/dev/null
    docker volume create "$drill_evidence" >/dev/null
    docker run \
      --detach \
      --rm \
      --name "$drill_container" \
      --network "$drill_network" \
      --shm-size 256m \
      --tmpfs "/var/lib/postgresql/data:rw,noexec,nosuid,size=$drill_tmpfs" \
      -e POSTGRES_USER="$drill_user" \
      -e POSTGRES_PASSWORD="$drill_password" \
      -e POSTGRES_DB="$drill_database" \
      "$postgres_image" >/dev/null

    attempts=0
    until docker exec "$drill_container" pg_isready -U "$drill_user" -d "$drill_database" >/dev/null 2>&1; do
      attempts=$((attempts + 1))
      [ "$attempts" -lt 60 ] || { echo "isolated PostgreSQL restore target did not become ready" >&2; exit 1; }
      sleep 1
    done

    docker exec -i "$drill_container" pg_restore \
      -U "$drill_user" \
      -d "$drill_database" \
      --no-owner \
      --no-privileges \
      --exit-on-error < "$dump"

    receipt_phase=database_reconcile
    restored_inventory="$receipt_stage/RESTORE-INVENTORY.tsv"
    docker exec -i "$drill_container" sh -s -- inventory < "$postgres_helper" > "$restored_inventory"
    if ! cmp -s "$database_inventory" "$restored_inventory"; then
      echo "isolated restore differs from the backup snapshot" >&2
      exit 1
    fi

    receipt_phase=evidence_restore
    docker run --rm -i \
      -v "$drill_evidence:/var/lib/ti-scraper/evidence" \
      "$scraper_image" tar -C /var/lib/ti-scraper/evidence -xzf - < "$objects"
    restored_evidence_archive="$receipt_stage/.restored-evidence.tar.gz"
    docker run --rm \
      -v "$drill_evidence:/var/lib/ti-scraper/evidence:ro" \
      "$scraper_image" tar -C /var/lib/ti-scraper/evidence -czf - . > "$restored_evidence_archive"
    receipt_phase=evidence_reconcile
    restored_evidence_inventory="$receipt_stage/RESTORE-EVIDENCE-INVENTORY.tsv"
    restored_object_ledger="$receipt_stage/RESTORE-OBJECT-LEDGER.tsv"
    inspect_evidence_archive "$restored_evidence_archive" "$restored_evidence_inventory" "$restored_object_ledger"
    rm -f -- "$restored_evidence_archive"
    if ! cmp -s "$evidence_inventory" "$restored_evidence_inventory"; then
      echo "isolated evidence restore differs from the backup" >&2
      exit 1
    fi
    if ! cmp -s "$object_ledger" "$restored_object_ledger"; then
      echo "isolated evidence restore differs from the DB-bound object ledger" >&2
      exit 1
    fi

    receipt_phase=application_read
    application_proof="$receipt_stage/APPLICATION-READ-PROOF.json"
    docker run --rm \
      --network "$drill_network" \
      -e TI_DATABASE_URL="postgresql://$drill_user:$drill_password@$drill_container:5432/$drill_database" \
      -e TI_RESTORE_EVIDENCE_ROOT=/var/lib/ti-scraper/evidence \
      -e TI_RESTORE_EVIDENCE_INVENTORY=/restore/EVIDENCE-INVENTORY.tsv \
      -e TI_RESTORE_OBJECT_LEDGER=/restore/OBJECT-LEDGER.tsv \
      -e TI_RESTORE_VERIFIER_COMMIT="$verifier_commit" \
      -e TI_RESTORE_SCRAPER_IMAGE_ID="$scraper_image_id" \
      -v "$drill_evidence:/var/lib/ti-scraper/evidence:ro" \
      -v "$evidence_inventory:/restore/EVIDENCE-INVENTORY.tsv:ro" \
      -v "$object_ledger:/restore/OBJECT-LEDGER.tsv:ro" \
      "$scraper_image" bun scripts/verify-restored-database.ts > "$application_proof"

    receipt_phase=cleanup
    cleanup_resources
    if docker container inspect "$drill_container" >/dev/null 2>&1 \
      || docker network inspect "$drill_network" >/dev/null 2>&1 \
      || docker volume inspect "$drill_evidence" >/dev/null 2>&1; then
      receipt_reason=cleanup_failed
      echo "isolated restore resources were not removed" >&2
      exit 1
    fi

    receipt_phase=publish
    source_inventory_hash=$(shasum -a 256 "$database_inventory" | awk '{print $1}')
    restored_inventory_hash=$(shasum -a 256 "$restored_inventory" | awk '{print $1}')
    restored_evidence_hash=$(shasum -a 256 "$restored_evidence_inventory" | awk '{print $1}')
    restored_object_hash=$(shasum -a 256 "$restored_object_ledger" | awk '{print $1}')
    {
      printf 'format=hanasand.threat_intel_restore_report.v3\n'
      printf 'status=succeeded\n'
      printf 'completed_at=%s\n' "$(date -u +%FT%TZ)"
      printf 'verifier_commit=%s\n' "$verifier_commit"
      printf 'scraper_image_id=%s\n' "$scraper_image_id"
      printf 'target=ephemeral_postgresql_container\n'
      printf 'target_removed=true\n'
      printf 'evidence_target=ephemeral_docker_volume\n'
      printf 'evidence_target_removed=true\n'
      printf 'database_inventory_sha256=%s\n' "$source_inventory_hash"
      printf 'restored_inventory_sha256=%s\n' "$restored_inventory_hash"
      printf 'schemas=%s\n' "$(awk -F '\t' 'NR > 1 { seen[$1] = 1 } END { for (schema in seen) count += 1; print count + 0 }' "$restored_inventory")"
      printf 'tables=%s\n' "$(awk 'NR > 1 { count += 1 } END { print count + 0 }' "$restored_inventory")"
      printf 'rows=%s\n' "$(awk -F '\t' 'NR > 1 { rows += $3 } END { printf "%.0f\n", rows + 0 }' "$restored_inventory")"
      printf 'content_hashes=matched\n'
      printf 'evidence_inventory_sha256=%s\n' "$restored_evidence_hash"
      printf 'evidence_files=%s\n' "$(awk 'NR > 1 { count += 1 } END { print count + 0 }' "$restored_evidence_inventory")"
      printf 'evidence_hashes=matched\n'
      printf 'object_ledger_sha256=%s\n' "$restored_object_hash"
      printf 'referenced_objects=%s\n' "$(awk 'NR > 1 { count += 1 } END { print count + 0 }' "$restored_object_ledger")"
      printf 'object_retention_differences=%s\n' "$(awk -F '\t' 'NR > 1 && $5 != $14 { count += 1 } END { print count + 0 }' "$restored_object_ledger")"
      printf 'evidence_object_reconciliation=passed\n'
      printf 'application_read=passed\n'
    } > "$receipt_stage/RESTORE-REPORT"
    (
      cd "$receipt_stage"
      shasum -a 256 RESTORE-INVENTORY.tsv RESTORE-EVIDENCE-INVENTORY.tsv RESTORE-OBJECT-LEDGER.tsv \
        APPLICATION-READ-PROOF.json RESTORE-REPORT > RESTORE-SHA256SUMS
    )

    receipt_id="RESTORE-RECEIPT-$(date -u +%Y%m%dT%H%M%SZ)-$$"
    receipt_target="$archive/$receipt_id"
    [ ! -e "$receipt_target" ] || { receipt_reason=receipt_exists; echo "restore receipt already exists" >&2; exit 1; }
    mv "$receipt_stage" "$receipt_target"
    receipt_stage=
    pointer_tmp=$(mktemp "$archive_parent/.RESTORE-LATEST.XXXXXX")
    printf '%s\n' "$receipt_id" > "$pointer_tmp"
    mv "$pointer_tmp" "$archive/RESTORE-LATEST"
    pointer_tmp=
    write_last_attempt succeeded 0 none || {
      printf '%s status=failed phase=receipt reason=status_write_failed exit_code=0\n' "$(date -u +%FT%TZ)" >&2
    }
    trap - EXIT INT TERM
    ;;
  *) usage ;;
esac
