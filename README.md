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
