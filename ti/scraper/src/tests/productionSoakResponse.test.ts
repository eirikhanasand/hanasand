import { describe, expect, test } from "bun:test";
import { coveragePercent } from "../../scripts/productionSoakResponse.ts";

describe("production soak source coverage", () => {
  test("uses measured search coverage and never invents a passing percentage", () => {
    expect(coveragePercent({
      sourceCoverage: {
        selectedSources: [{ id: "source_a" }],
        missingApprovedSources: [{ id: "source_b" }]
      }
    })).toBe(50);
    expect(coveragePercent({ sourceCoverage: {} })).toBe(0);
    expect(coveragePercent(undefined)).toBe(0);
  });
});
