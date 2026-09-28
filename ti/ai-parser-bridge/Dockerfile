FROM oven/bun:1.3.11-alpine
COPY .git/HEAD /tmp/hanasand-source-head
RUN test "$(cat /tmp/hanasand-source-head)" = "ref: refs/heads/main" || { echo "Production image builds are allowed only from the main branch." >&2; exit 1; }


WORKDIR /app

COPY ti/ai-parser-bridge/server.mjs /app/server.mjs

EXPOSE 18181

CMD ["bun", "/app/server.mjs"]
