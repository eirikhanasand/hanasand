FROM oven/bun:1.3.11
COPY .git/HEAD /tmp/hanasand-source-head
RUN test "$(cat /tmp/hanasand-source-head)" = "ref: refs/heads/main" || { echo "Production image builds are allowed only from the main branch." >&2; exit 1; }
USER root
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY frontend/package.json frontend/bun.lock frontend/bunfig.toml ./
RUN bun install --frozen-lockfile
COPY frontend/scripts/code-inventory.mjs frontend/scripts/code-inventory-watch.mjs ./scripts/
RUN mkdir -p /home/bun/.ssh && chown bun:bun /home/bun/.ssh && chmod 700 /home/bun/.ssh
USER bun
# A commit inventory is incremental, but indexing a changed commit can take longer
# than one healthcheck interval. Treat recent indexing as healthy while still
# failing closed for errors or a stalled worker.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 CMD bun -e 'try { const s = await Bun.file("/published/status.json").json(); const recent = Date.now() - Date.parse(s.checkedAt) < 120000; process.exit(recent && (s.phase === "ready" || s.phase === "indexing") ? 0 : 1) } catch { process.exit(1) }'
CMD ["bun", "scripts/code-inventory-watch.mjs", "/repository", "/published"]
