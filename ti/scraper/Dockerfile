FROM oven/bun:1.3.11-alpine AS deps

WORKDIR /app/ti/scraper

COPY ti/scraper/package.json ti/scraper/bun.lock* ti/scraper/bunfig.toml ./
RUN bun install

FROM oven/bun:1.3.11-alpine AS test

WORKDIR /app/ti/scraper
COPY --from=deps /app/ti/scraper/node_modules /app/ti/scraper/node_modules
COPY . /app/
WORKDIR /app/ti/scraper
RUN bun run check

FROM test AS runtime

WORKDIR /app/ti/scraper
ENV NODE_ENV=production \
    SCRAPER_PORT=8097 \
    SCRAPER_ENV=production

EXPOSE 8097

CMD ["bun", "run", "start"]
