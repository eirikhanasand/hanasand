import { describe, expect, test } from "bun:test";
import { registry, seedSource } from "./helpers/registryFixtures.ts";

describe("source registry validation", () => {
  test("requires legal notes", () => {
    expect(() => registry().upsert(seedSource({ legalNotes: "" }))).toThrow("legal notes");
  });

  test("clamps trust score", () => {
    const source = registry().upsert(seedSource({ trustScore: 2 }));
    expect(source.trustScore).toBe(1);
  });

  test("deduplicates seed source ingestion by tenant, type, and URL", () => {
    const source = seedSource({ status: "candidate" });
    expect(() => registry().ingestSeedSources([source, source])).toThrow("Duplicate seed source");
  });

  test("rejects credential-bearing and private-network HTTP sources", () => {
    expect(() => registry().upsert(seedSource({ url: "https://user:pass@example.test/feed" }))).toThrow("must not contain credentials");
    expect(() => registry().upsert(seedSource({ url: "http://127.0.0.1/feed" }))).toThrow("must not target a private network");
    expect(() => registry().upsert(seedSource({ url: "http://[::1]/feed" }))).toThrow("must not target a private network");
  });
});
