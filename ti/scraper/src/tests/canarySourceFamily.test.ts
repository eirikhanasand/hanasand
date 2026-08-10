import { describe, expect, test } from "bun:test";
import { sourceFamilyMatches } from "../ops/canaryCollection.ts";

describe("production canary source family selection", () => {
  test("accepts a bounded comma-separated family list", () => {
    const source = { type: "rss", metadata: { sourceFamily: "clear_web" } };
    expect(sourceFamilyMatches(source, "darkweb_metadata, clear_web")).toBe(true);
    expect(sourceFamilyMatches(source, "darkweb_metadata")).toBe(false);
    expect(sourceFamilyMatches(source, "")).toBe(true);
  });
});
