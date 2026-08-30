# hanasand

## Deployment

From the canonical production checkout, deploy with:

```sh
make deploy
```

This performs a health-gated blue/green frontend handoff, keeping the current
instance live until the replacement is ready. Do not use `docker compose up
--build` directly for production: Compose replaces the only frontend container
before the rebuilt one is ready, which creates a Bad Gateway window.
