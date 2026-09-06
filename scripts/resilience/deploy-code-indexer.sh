#!/bin/sh
set -eu
cd /home/hanasand/hanasand
release=$(git rev-parse HEAD)
root=/home/hanasand/code-review
mkdir -p "$root/published"
chmod 750 "$root" "$root/published"
if ! test -d "$root/repository.git"; then git clone --bare . "$root/repository.git"; fi
for remote in origin github; do
 url=$(git remote get-url "$remote")
 if git --git-dir="$root/repository.git" remote get-url "$remote" >/dev/null 2>&1; then
  git --git-dir="$root/repository.git" remote set-url "$remote" "$url"
 else
  git --git-dir="$root/repository.git" remote add "$remote" "$url"
 fi
done
image=hanasand-code-indexer:$release
if ! docker image inspect "$image" >/dev/null 2>&1; then
 git archive "$release" | docker build -f frontend/CodeInventory.Dockerfile -t "$image" -
fi
if docker inspect hanasand-code-indexer >/dev/null 2>&1; then
 docker stop -t 35 hanasand-code-indexer >/dev/null
 docker rm hanasand-code-indexer >/dev/null
fi
printf '%s' '{"phase":"starting"}' > "$root/published/status.json"
docker run -d --name hanasand-code-indexer --restart unless-stopped --init --read-only --network host --memory 4g --cpus 2 --tmpfs /tmp:rw,size=1g,mode=1777 \
 -v "$root/repository.git:/repository" -v "$root/published:/published" \
 -v /home/hanasand/.ssh/id_ecdsa:/home/bun/.ssh/id_ecdsa:ro \
 -v /home/hanasand/.ssh/known_hosts:/home/bun/.ssh/known_hosts:ro "$image"
for attempt in $(seq 1 60); do
 if python3 - "$root/published/status.json" <<'PY'
import json,sys,time,datetime
try:
 s=json.load(open(sys.argv[1])); age=time.time()-datetime.datetime.fromisoformat(s['checkedAt'].replace('Z','+00:00')).timestamp()
 sys.exit(0 if s['phase']=='ready' and age<15 else 1)
except Exception:sys.exit(1)
PY
 then exit 0; fi
 sleep 2
done
echo 'The Git indexer did not become ready. The serving frontend pair is unchanged.' >&2
exit 1
