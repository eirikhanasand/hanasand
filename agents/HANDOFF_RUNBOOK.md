---
last_updated: 2026-05-01
---

# Hanasand Local Handoff Runbook

Use this when a user asks Hanasand AI to work across the local desktop repos or to redeploy the Hanasand server.

## Multi-repo local tasks

`/Users/eirikhanasand/Desktop/personal` is a multi-repo parent, not a single Git repository. If Codex refuses to start there because of the repo check, restart from that parent with:

```bash
codex --skip-git-repo-check
```

Then inspect each target repo independently with `git -C <repo> status --short`. Do not treat the parent directory as the Git worktree.

## Hanasand server discovery

Infer "Hanasand server" from local context before asking the parent agent:

- shell alias: `ssh hanasand`
- SSH config host: `Host hanasand`
- current target: `hanasand@hanasand.com`, port `222`
- dirty working repo path: `/home/hanasand/hanasand`
- clean deploy checkout path: `/home/hanasand/hanasand-deploy-64d9339`
- OpenResty path: `/home/hanasand/openresty`
- expected app deploy path: `cd /home/hanasand/hanasand-deploy-64d9339 && git fetch github main && git pull --ff-only github main`
- expected app restart from the deploy checkout: `docker compose -p hanasand up -d --build`
- browser sandbox changes must build the separate worker image before restarting API: `docker compose -p hanasand --profile unsafe-dev-only build api browser-worker && docker compose -p hanasand up -d --no-deps api`
- if only the web/API images need replacing after a successful build, use `docker compose -p hanasand up -d --no-deps frontend api`
- expected public archive smoke after app deploy: `cd /home/hanasand/hanasand-deploy-64d9339/frontend && PUBLIC_ARCHIVE_BASE_URL=http://127.0.0.1:3000 bun run test:public-archive`
- active web server: Docker container `openresty`
- expected OpenResty verification: `cd /home/hanasand/openresty && docker compose exec -T openresty openresty -t`

For upload-limit changes, update the local `/Users/eirikhanasand/Desktop/personal/openresty` repo, push it, deploy `/home/hanasand/openresty`, then verify the CDN server block contains `client_max_body_size 50M;`.

## Remote deploy execution mode

Codex sandboxed executions can allow simple read-only SSH commands while blocking copy/write-style invocations such as `scp`, `tar | ssh`, `ssh ... < script`, or long local-stdin SSH pipelines with:

```text
ssh: connect to host hanasand.com port 222: Operation not permitted
```

When that happens, do not keep retrying `scp` or piped SSH. Use a remote-capable execution mode that permits outbound SSH without local stdin/copy restrictions, or open an interactive SSH session with `ssh -o BatchMode=yes hanasand` and apply scoped patches or heredocs through the already-established session. Keep remote deploys narrow: patch only the intended files, avoid private media uploads, then run the active OpenResty and Docker checks.

On this host, do not edit `/etc/nginx/sites-available/internal` for live changes. The active OpenResty config is owned by `/home/hanasand/openresty` and loaded through Docker with host networking so existing `localhost` upstreams keep working.

## Failure handling rule

Guardrail failures, handoff failures, and deploy-discovery failures are task failures. If a worker cannot read Codex session files, cannot start in the multi-repo parent, or cannot discover the server path, harden this runbook or `agents/scripts/handoff-context.mjs` as part of the fix before handing back.
