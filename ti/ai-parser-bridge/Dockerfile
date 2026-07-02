FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY ti/ai-parser-bridge/server.mjs /app/server.mjs

EXPOSE 18181

CMD ["bun", "/app/server.mjs"]
