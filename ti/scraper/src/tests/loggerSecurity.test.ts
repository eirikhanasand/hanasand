import { describe, expect, test } from "bun:test";
import { extractReserved, sanitizeFields } from "../ops/loggerSanitize.ts";

describe("structured logger security", () => {
  test("redacts secrets and restricted locators from reserved and nested strings", () => {
    const onion = `${"a".repeat(56)}.onion`;
    const unsafe = `fetch https://example.test/path?token=url-secret failed at ${onion} password=hunter2 authorization=Bearer-secret`;
    const output = { ...extractReserved({ error: unsafe }), fields: sanitizeFields({ errors: [{ message: unsafe }], note: unsafe }) };
    const serialized = JSON.stringify(output);

    expect(serialized).not.toContain("url-secret");
    expect(serialized).not.toContain(onion);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("Bearer-secret");
    expect(serialized).toContain("[redacted-url]");
    expect(serialized).toContain("[restricted-host]");
  });
});
