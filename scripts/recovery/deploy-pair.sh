#!/bin/sh
set -eu
sh /home/hanasand/hanasand/scripts/require-main.sh
kind=${1:?frontend, api or auth required}; shift
case "$kind" in frontend|api|auth) ;; *) exit 2;; esac
test "$(pwd)" = /home/hanasand/hanasand
exec 9>/tmp/hanasand-frontend-deploy.lock
flock 9
root=/home/hanasand/hanasand/ops/runtime
release=${HANASAND_RELEASE_COMMIT:-$(git rev-parse HEAD)}
test "$(git rev-parse --verify "$release^{commit}")" = "$release"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
image=hanasand-recovery-$kind:$release
case "${1:-}" in
 --no-build)
  docker image inspect "$image" >/dev/null 2>&1 || { echo 'The exact release image must be built before --no-build.' >&2; exit 1; };;
 '')
  test "$release" = "$(git rev-parse HEAD)" || { echo 'Build the selected release from its clean archive, then use --no-build.' >&2; exit 1; }
  case "$kind" in
   frontend) docker build -f frontend/Dockerfile -t "$image" .;;
   api) docker build -f api/Dockerfile --build-arg SESSION_GEOIP_MONTH="$(date -u +%Y-%m)" --target app-runtime --build-context database_schema=./db -t "$image" .;;
   auth) docker build -f api/Dockerfile --build-arg SESSION_GEOIP_MONTH="$(date -u +%Y-%m)" --target auth-runtime -t "$image" .;;
  esac;;
 *) exit 2;;
esac
if test "$kind" = api; then
 # Inspect the selected image, not a newer checkout; legacy rollback stays safe.
 search_index=$(docker run --rm --network none --entrypoint bun "$image" -e 'import { readFileSync } from "node:fs"; process.stdout.write(readFileSync("/app/src/utils/logs/searchText.ts", "utf8").includes("logPhraseSearchExpression") ? "phrase" : "legacy")')
 if test "$search_index" = phrase; then
  valid=$(docker exec hanasand_database psql -X -At -v ON_ERROR_STOP=1 -U hanasand -d hanasand -c "SELECT COALESCE((SELECT i.indisvalid AND i.indisready AND t.relname = 'events' FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid WHERE i.indexrelid = to_regclass('idx_logs_phrase_trgm')), false)")
  test "$valid" = t || { echo 'The search index is not ready. The serving API has been left unchanged.' >&2; exit 1; }
 else
  test "$search_index" = legacy || { echo 'Unable to verify the API search index requirement.' >&2; exit 1; }
 fi
fi
if test "$kind" = frontend; then sh scripts/recovery/deploy-code-indexer.sh; fi
old_ports=$(node - "$root/config.json" "$kind" <<'JS'
const fs = require('node:fs');
const [file, kind] = process.argv.slice(2);
const service = JSON.parse(fs.readFileSync(file, 'utf8')).services.find(item => item.id === kind);
process.stdout.write(service.instances.filter(item => item.site === 'inspur').map(item => item.address.split(':').at(-1)).join(' '));
JS
)
case "$kind:$old_ports" in
 'frontend:3200 3300') ports='3000 3100';; frontend:*) ports='3200 3300';;
 'api:8082 8083') ports='20802 20803';; api:*) ports='8082 8083';;
 'auth:8181 8182') ports='8183 8184';; auth:*) ports='8181 8182';;
esac
pair_name() { "$script_dir/../run-typescript-node.sh" "$script_dir/container_names.ts" "$kind" "$1"; }
source=hanasand_api
if test "$kind" = frontend; then source=$(pair_name "$(printf '%s' "$old_ports" | cut -d' ' -f1)"); fi
# Only stale, stopped task-owned candidates may be removed to reuse an inactive slot.
for port in $ports; do
 name=$(pair_name "$port")
 if docker inspect "$name" >/dev/null 2>&1; then
  test "$(docker inspect -f '{{.State.Running}}' "$name")" = false || { echo "Candidate $name is still running" >&2; exit 1; }
  docker rm "$name" >/dev/null
 fi
done
"$script_dir/../run-typescript-node.sh" "$script_dir/start-inspur-pair.ts" "$kind" "$image" "$source" $ports
path=/ready
test "$kind" != frontend || path=/api/recovery/ready
test "$kind" != api || path=/health
for port in $ports; do
 ready=0
 for attempt in $(seq 1 60); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$port$path" | node -e 'let body="";process.stdin.setEncoding("utf8");process.stdin.on("data",chunk=>body+=chunk);process.stdin.on("end",()=>{try{const value=JSON.parse(body);process.exit(value.ok===true&&value.release===process.argv[1]?0:1)}catch{process.exit(1)}})' "$release"; then ready=1; break; fi
  sleep 2
 done
 test "$ready" = 1 || { echo 'Candidate failed readiness; serving pair retained' >&2; exit 1; }
done
backup=$(mktemp)
cp "$root/config.json" "$backup"
rollback() { cp "$backup" "$root/config.json"; sh scripts/recovery/start-routing.sh "$root" || true; }
trap rollback EXIT HUP INT TERM
node - "$root/config.json" "$kind" $ports <<'JS'
const fs = require('node:fs');
const [file, kind, ...ports] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const service = config.services.find(item => item.id === kind);
service.checkPath = kind === 'frontend' ? '/api/recovery/ready' : kind === 'api' ? '/health' : '/ready';
for (const [item, port] of service.instances.filter(value => value.site === 'inspur').map((item, index) => [item, ports[index]])) {
  Object.assign(item, { address: `127.0.0.1:${port}`, health: `http://127.0.0.1:${port}${service.checkPath}`, endpoint: `inspur:${port}` });
}
fs.writeFileSync(file, JSON.stringify(config, null, 2));
JS
sh scripts/recovery/start-routing.sh "$root"
trap - EXIT HUP INT TERM
rm -f "$backup"
sleep 65
for port in $old_ports; do
 name=$(pair_name "$port")
 docker stop -t 65 "$name" >/dev/null
 # The replacement pair has passed readiness and the old workers have drained.
 # Keep images and persistent volumes; retire only the superseded containers.
 docker rm "$name" >/dev/null
done
printf '%s deployed: %s; two serving instances on %s\n' "$kind" "$release" "$ports"
