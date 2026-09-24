FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY ti/ai-model-client/client.mjs ti/ai-model-client/power.mjs ti/ai-model-client/lanes.mjs ti/ai-model-client/model-probe.mjs ti/ai-model-client/prompt-evidence.mjs /app/ti/ai-model-client/
COPY api/src/utils/logs/redact.ts /app/api/src/utils/logs/redact.ts

# Keep the established entrypoint for deployments preserving container settings.
RUN printf 'import "./ti/ai-model-client/client.mjs";\n' > /app/client.mjs

EXPOSE 18182

CMD ["bun", "/app/client.mjs"]
