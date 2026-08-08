import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ANNOCTR_CORPUS_FILES, loadAnnoCtrEvaluationCorpus, parseAnnoCtrBio } from "../evaluation/annoCtrCorpus.ts";

const bio = `<DOCSTART>\tO\tO\tO\tO\tO\tO

APT40\tO\tO\tO\tB-GROUP\tO\tB-GROUP
used\tO\tO\tO\tO\tO\tO
PlugX\tO\tO\tO\tB-MALWARE\tO\tB-MALWARE
against\tO\tO\tO\tO\tO\tO
Supply\tB-SECTOR\tO\tO\tB-TECHNIQUE\tO\tB-SECTOR
Chain\tI-SECTOR\tO\tO\tI-TECHNIQUE\tO\tI-SECTOR
Attacks\tO\tO\tO\tI-TECHNIQUE\tO\tI-TECHNIQUE
.\tO\tO\tO\tO\tO\tO

No\tO\tO\tO\tO\tO\tO
mapped\tO\tO\tO\tO\tO\tO
entity\tO\tO\tO\tO\tO\tO
.\tO\tO\tO\tO\tO\tO
`;

describe("offline AnnoCTR evaluation corpus", () => {
  test("maps only defensible human BIO labels and preserves fixed negative examples", () => {
    const records = parseAnnoCtrBio(bio, "test");
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      recordId: "test:doc-0:sentence-0",
      text: "APT40 used PlugX against Supply Chain Attacks.",
      labels: { actor: ["APT40"], malware: ["PlugX"], ttp: ["Supply Chain Attacks"], sector: ["Supply Chain"] }
    });
    expect(records[1].labels).toEqual({ actor: [], malware: [], ttp: [], sector: [] });
    expect(Object.values(ANNOCTR_CORPUS_FILES).every((file) => /^[a-f0-9]{64}$/.test(file.sha256) && file.url.includes("d510b6949e1938d47c93a43eedd562dc538439dc"))).toBe(true);
    expect(() => parseAnnoCtrBio("orphan\tO\tO\tO\tO\tO\tO\n")).toThrow("before DOCSTART");
  });

  test("rejects corpus bytes that do not match the pinned upstream checksums", async () => {
    const requested: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => { requested.push(String(input)); return new Response(bio, { status: 200 }); };
    await expect(loadAnnoCtrEvaluationCorpus(fetcher as typeof fetch)).rejects.toThrow("checksum mismatch");
    expect(requested.sort()).toEqual(Object.values(ANNOCTR_CORPUS_FILES).map((file) => file.url).sort());
  });

  test("has no production startup, persistence, benchmark, or metric caller", () => {
    const root = join(import.meta.dir, "../..");
    const startup = readFileSync(join(root, "src/runtime/startup.ts"), "utf8");
    const evaluation = readFileSync(join(root, "src/api/evaluationBenchmarkRoutes.ts"), "utf8");
    const metrics = readFileSync(join(root, "src/pipeline/evaluationMetrics.ts"), "utf8");
    const corpus = readFileSync(join(root, "src/evaluation/annoCtrCorpus.ts"), "utf8");
    expect(`${startup}\n${evaluation}\n${metrics}`).not.toMatch(/annoctr/i);
    expect(corpus).not.toMatch(/save(?:Capture|PipelineResult|ValidationRecord|EvaluationBenchmark)/);
  });
});
