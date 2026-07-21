import { expect, test } from "bun:test";
import { extractEntities } from "../pipeline/extractors.ts";

test("does not collapse distinct ATT&CK groups through associated names", () => {
  expect(actor("APT42 was reported.")).toBe("APT42");
  expect(actor("Charming Kitten was reported.")).toBe("Magic Hound");
  expect(actor("FIN7 was reported.")).toBe("FIN7");
  expect(actor("Carbanak was reported.")).toBe("Carbanak");
});

function actor(text: string) {
  return extractEntities(text, {
    sourceId: "src_mitre_actor_separation",
    captureId: "cap_mitre_actor_separation",
    url: "https://attack.mitre.org/groups/",
    collectedAt: "2026-07-21T00:00:00.000Z",
    contentHash: "official-v19.1-identity-check"
  }).find((entity) => entity.type === "actor")?.value;
}
