import { describe, expect, test } from "bun:test";
import { evaluateSourceForCollection, sourceCollectionLane } from "../policy/collectionPolicy.ts";

const exposureSource = (overrides: Record<string, unknown> = {}) => ({
  id: "src-exposure",
  name: "Public exposure feed",
  type: "darkweb_metadata",
  url: "https://example.test/rss.xml",
  accessMethod: "public_http",
  status: "active",
  risk: "low",
  legalNotes: "Public metadata-only feed for defensive exposure monitoring.",
  metadata: { exposureQueueSource: true },
  ...overrides
}) as any;

describe("collection policy public exposure metadata", () => {
  test("allows only explicit HTTPS exposure feeds in the public lane", () => {
    const source = exposureSource();
    expect(evaluateSourceForCollection(source)).toMatchObject({ allowed: true, metadataOnly: true });
    expect(sourceCollectionLane(source)).toBe("public");
  });

  test("rejects non-HTTPS exposure feeds", () => {
    const source = exposureSource({ url: "http://example.test/rss.xml" });
    expect(evaluateSourceForCollection(source).allowed).toBe(false);
    expect(sourceCollectionLane(source)).toBeUndefined();
  });
});
