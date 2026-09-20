#!/bin/sh
set -eu
kind=${1:?frontend, api or auth required}; shift
case "$kind" in frontend|api|auth) ;; *) exit 2;; esac
test "$(pwd)" = /home/hanasand/hanasand
exec 9>/tmp/hanasand-frontend-deploy.lock
flock 9
root=/home/hanasand/resilience
release=${HANASAND_RELEASE_COMMIT:-$(git rev-parse HEAD)}
test "$(git rev-parse --verify "$release^{commit}")" = "$release"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
image=hanasand-resilience-$kind:$release
case "${1:-}" in
 --no-build)
  docker image inspect "$image" >/dev/null 2>&1 || { echo 'The exact release image must be built before --no-build.' >&2; exit 1; };;
 '')
  test "$release" = "$(git rev-parse HEAD)" || { echo 'Build the selected release from its clean archive, then use --no-build.' >&2; exit 1; }
  case "$kind" in
   frontend) git archive "$release" | docker build -f frontend/Dockerfile -t "$image" -;;
   api) docker build --build-arg SESSION_GEOIP_MONTH="$(date -u +%Y-%m)" --target app-runtime --build-context database_schema=./db -t "$image" api;;
   auth) docker build --build-arg SESSION_GEOIP_MONTH="$(date -u +%Y-%m)" --target auth-runtime -t "$image" api;;
  esac;;
 *) exit 2;;
esac
if test "$kind" = api; then
 # Inspect the selected image, not a newer checkout; legacy rollback stays safe.
 search_index=$(docker run --rm --network none --entrypoint bun "$image" -e 'import { readFileSync } from "node:fs"; process.stdout.write(readFileSync("/app/src/utils/logs/searchText.ts", "utf8").includes("logPhraseSearchExpression") ? "phrase" : "legacy")')
 if test "$search_index" = phrase; then
  valid=$(docker exec hanasand_database psql -X -At -v ON_ERROR_STOP=1 -U hanasand -d hanasand -c "SELECT COALESCE((SELECT indisvalid AND indisready FROM pg_index WHERE indexrelid = to_regclass('idx_mill_logs_phrase_trgm')), false)")
  test "$valid" = t || { echo 'The search index is not ready. The serving API has been left unchanged.' >&2; exit 1; }
 else
  test "$search_index" = legacy || { echo 'Unable to verify the API search index requirement.' >&2; exit 1; }
 fi
fi
if test "$kind" = frontend; then sh scripts/resilience/deploy-code-indexer.sh; fi
old_ports=$(python3 - "$root/config.json" "$kind" <<'JSON'
import json,sys
s=next(s for s in json.load(open(sys.argv[1]))['services'] if s['id']==sys.argv[2])
print(' '.join(i['address'].rsplit(':',1)[1] for i in s['instances'] if i['site']=='inspur'))
JSON
)
case "$kind:$old_ports" in
 'frontend:3200 3300') ports='3000 3100';; frontend:*) ports='3200 3300';;
 'api:8082 8083') ports='20802 20803';; api:*) ports='8082 8083';;
 'auth:8181 8182') ports='8183 8184';; auth:*) ports='8181 8182';;
esac
pair_name() { python3 "$script_dir/container_names.py" "$kind" "$1"; }
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
python3 "$script_dir/start-inspur-pair.py" "$kind" "$image" "$source" $ports
path=/ready; test "$kind" != frontend || path=/api/resilience/ready
for port in $ports; do
 ready=0
 for attempt in $(seq 1 60); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$port$path" | python3 -c 'import json,sys; s=json.load(sys.stdin);sys.exit(0 if s.get("ok") and s.get("release")==sys.argv[1] else 1)' "$release"; then ready=1; break; fi
  sleep 2
 done
 test "$ready" = 1 || { echo 'Candidate failed readiness; serving pair retained' >&2; exit 1; }
done
backup=$(mktemp)
cp "$root/config.json" "$backup"
rollback() { cp "$backup" "$root/config.json"; sh scripts/resilience/start-routing.sh "$root" || true; }
trap rollback EXIT HUP INT TERM
python3 - "$root/config.json" "$kind" $ports <<'JSON'
import json,pathlib,sys
p=pathlib.Path(sys.argv[1]);c=json.loads(p.read_text());s=next(s for s in c['services'] if s['id']==sys.argv[2]);s['checkPath']='/api/resilience/ready' if s['id']=='frontend' else '/ready'
for item,port in zip([i for i in s['instances'] if i['site']=='inspur'],sys.argv[3:]):
 item.update(address='127.0.0.1:'+port,health='http://127.0.0.1:'+port+s['checkPath'],endpoint='inspur:'+port)
p.write_text(json.dumps(c,indent=2))
JSON
sh scripts/resilience/start-routing.sh "$root"
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
