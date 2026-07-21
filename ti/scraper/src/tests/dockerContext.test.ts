import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { assertDockerContextsWithinLimits, estimateDockerContext } from "../ops/dockerContext.ts";

describe("docker context guard", () => {
  test("honors dockerignore negation rules and size limits", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-docker-context-"));
    mkdirSync(join(root, "frontend"), { recursive: true });
    mkdirSync(join(root, "frontend", ".next"), { recursive: true });
    mkdirSync(join(root, "api"), { recursive: true });
    mkdirSync(join(root, "large-unrelated"), { recursive: true });
    writeFileSync(join(root, ".dockerignore"), [
      "*",
      "!frontend",
      "!frontend/**",
      "!api",
      "!api/**",
      "frontend/.next",
      "large-unrelated"
    ].join("\n"));
    writeFileSync(join(root, "frontend", "page.tsx"), "x".repeat(100));
    writeFileSync(join(root, "frontend", ".next", "cache.bin"), "x".repeat(10_000));
    writeFileSync(join(root, "api", "server.ts"), "x".repeat(50));
    writeFileSync(join(root, "large-unrelated", "blob.bin"), "x".repeat(10_000));

    const estimate = estimateDockerContext({ name: "root", contextDir: root, maxBytes: 1_000 });

    expect(estimate.status).toBe("ok");
    expect(estimate.totalBytes).toBeLessThan(1_000);
    expect(estimate.includedFiles).toBe(2);
    expect(estimate.ignoredEntries).toBeGreaterThan(0);
    expect(() => assertDockerContextsWithinLimits([estimate])).not.toThrow();
  });

  test("fails fast when context estimate exceeds the ceiling", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-docker-context-large-"));
    writeFileSync(join(root, "Dockerfile"), "FROM scratch\n");
    writeFileSync(join(root, "payload.bin"), "x".repeat(2_000));

    const estimate = estimateDockerContext({ name: "too-large", contextDir: root, maxBytes: 1_000 });

    expect(estimate.status).toBe("critical");
    expect(() => assertDockerContextsWithinLimits([estimate])).toThrow("too-large Docker context");
  });

  test("uses a Dockerfile-specific ignore file for a shared root context", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-docker-context-specific-"));
    mkdirSync(join(root, "service"), { recursive: true });
    writeFileSync(join(root, ".dockerignore"), "\n");
    writeFileSync(join(root, "service", "Dockerfile.dockerignore"), "*\n!service/**\n");
    writeFileSync(join(root, "service", "app.ts"), "x".repeat(100));
    writeFileSync(join(root, "unrelated.bin"), "x".repeat(10_000));

    const dockerignorePath = join(root, "service", "Dockerfile.dockerignore");
    const estimate = estimateDockerContext({ name: "service", contextDir: root, dockerignorePath, maxBytes: 1_000 });

    expect(estimate.status).toBe("ok");
    expect(estimate.dockerignorePath).toBe(dockerignorePath);
    expect(estimate.includedFiles).toBe(2);
  });
});
