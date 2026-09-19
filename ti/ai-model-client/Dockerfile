FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY ti/ai-model-client/client.mjs ti/ai-model-client/power.mjs /app/

EXPOSE 18182

CMD ["bun", "/app/client.mjs"]
