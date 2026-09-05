# hanasand

## Deployment

On the production server, from `/home/hanasand/hanasand`, run:

```sh
./scripts/deploy.sh
# Equivalent: make deploy
```

The deploy command builds the new frontend, checks that it is working, switches
traffic to it, and then removes the old container. Do not run `docker compose
up --build` directly in production. It stops the current frontend before the
new one is ready and causes a short 502 error.


For API changes, deploy only that service before deploying the frontend:

```sh
docker compose up -d --no-deps --build api
./scripts/deploy.sh
```

Do not rebuild the entire stack. API startup applies the database schema updates.

The shared thesis is available at `/thesis` and under Dashboard → Admin → Thesis
(`/dashboard/thesis`). Only the authenticated account ID `eirikhanasand` can edit
and save it. PostgreSQL stores a single row in `thesis`, with separate `title`
and `content` columns. Display names do not determine editing permission.


Thesis edits autosave five seconds after the first pending edit, with no repeated
writes when unchanged. Saved changes broadcast to readers over
`/api/ws/thesis`. Hiding or closing the page sends a final save, and each edit is
also kept as a local recovery draft. Browser shutdown/network failures cannot
guarantee delivery, and keepalive requests have a roughly 64 KiB limit; recovery
drafts cover interrupted delivery and can be reopened from the editor.

History preserves the immediate previous version plus one checkpoint before the
first edit in each 20-minute UTC window for seven days. Older checkpoints compact
to the first checkpoint of each eight-hour UTC block (up to three per day).
Compaction runs on saves and history reads. Duplicate saves create no revision
or history entry. Concurrent stale writes are rejected and the editor offers a
choice of local or latest text. History and restoration remain owner-only;
restoring uses the normal save path, preserving what it replaces.
