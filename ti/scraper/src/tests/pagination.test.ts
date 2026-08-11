import { describe, expect, test } from "bun:test";
import { decodeKeysetCursor, encodeKeysetCursor, legacyOffset } from "../api/pagination.ts";

describe("keyset pagination cursors", () => {
  test("round trips an opaque timestamp/id cursor", () => {
    const encoded = encodeKeysetCursor("2026-08-12T10:00:00.000Z", "row-42");
    expect(encoded).toBeDefined();
    expect(decodeKeysetCursor(encoded)).toEqual({ at: "2026-08-12T10:00:00.000Z", id: "row-42" });
  });

  test("keeps numeric cursors as legacy offsets", () => {
    expect(decodeKeysetCursor("50")).toBeUndefined();
    expect(legacyOffset("50")).toBe(50);
    expect(legacyOffset("not-a-cursor")).toBe(0);
  });
});
