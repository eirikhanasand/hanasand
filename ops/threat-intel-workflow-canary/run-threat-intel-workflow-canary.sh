#!/bin/sh
set -eu

docker exec hanasand_ti_scraper bun run scripts/run-operational-workflow-canary.ts
