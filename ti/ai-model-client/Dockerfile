FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY ti/ai-model-client/client.mjs /app/client.mjs

EXPOSE 18182

CMD ["bun", "/app/client.mjs"]
