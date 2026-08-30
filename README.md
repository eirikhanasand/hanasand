# hanasand

## Deployment

On the production server, from `/home/hanasand/hanasand`, run:

```sh
make deploy
```

The deploy command builds the new frontend, checks that it is working, switches
traffic to it, and then removes the old container. Do not run `docker compose
up --build` directly in production. It stops the current frontend before the
new one is ready and causes a short 502 error.
