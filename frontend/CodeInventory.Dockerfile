FROM oven/bun:1.3.11
USER root
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY frontend/package.json frontend/bun.lock frontend/bunfig.toml ./
RUN bun install --frozen-lockfile
COPY frontend/scripts/code-inventory.mjs frontend/scripts/code-inventory-watch.mjs ./scripts/
RUN mkdir -p /home/bun/.ssh && chown bun:bun /home/bun/.ssh && chmod 700 /home/bun/.ssh
USER bun
CMD ["bun", "scripts/code-inventory-watch.mjs", "/repository", "/published"]
