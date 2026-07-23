import { expect, test } from "bun:test";
import { extractEntities } from "../pipeline/extractors.ts";
import { actorIdentity } from "./apiTestHarness.ts";

const identities = [
  actorIdentity("G1001", "APT42"),
  actorIdentity("G0059", "Magic Hound", ["Charming Kitten"]),
  actorIdentity("G0046", "FIN7"),
  actorIdentity("G0008", "Carbanak"),
];

test("does not collapse distinct ATT&CK groups through associated names", () => {
  expect(actor("APT42 was reported.")).toBe("APT42");
  expect(actor("Charming Kitten was reported.")).toBe("Charming Kitten");
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
  }, identities).find((entity) => entity.type === "actor")?.value;
}
