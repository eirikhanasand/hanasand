import { describe, expect, test } from "bun:test";
import { basename } from "node:path";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("sdk fixture pack", () => {
  test("materializes every contracted SDK fixture without unsafe fields", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as {
      sdkIntegration: {
        fixturePack: {
          fixtureNames: string[];
          requiredFiles: string[];
          invariantFields: string[];
          noLeakAssertions: string[];
        };
        compatibilityCi: {
          requiredCommands: string[];
        };
      };
    };
    const fixturePack = contract.sdkIntegration.fixturePack;
    expect(contract.sdkIntegration.compatibilityCi.requiredCommands).toContain("bun run check:sdk-fixtures");
    expect(fixturePack.requiredFiles).toHaveLength(fixturePack.fixtureNames.length);
    expect(fixturePack.noLeakAssertions).toEqual(expect.arrayContaining([
      "no raw_body",
      "no restricted_raw_url",
      "no credential",
      "no authorization",
      "no cookie",
      "no object_reference",
      "no leaked_row"
    ]));

    for (const file of fixturePack.requiredFiles) {
      const fixtureFile = Bun.file(file);
      expect(await fixtureFile.exists()).toBe(true);
      const fixture = await fixtureFile.json() as Record<string, unknown>;
      const fixtureName = basename(file, ".json");
      expect(fixture.fixtureName).toBe(fixtureName);
      expect(fixture.schemaVersion).toBe("ti.sdk_fixture.v1");
      for (const field of fixturePack.invariantFields) {
        expect(fixture).toHaveProperty(field);
      }
      expect(JSON.stringify(fixture)).not.toMatch(/raw_body|restricted_raw_url|credential|authorization|cookie|object_reference|leaked_row|password|bearer|private_key/i);
    }
  });
});
