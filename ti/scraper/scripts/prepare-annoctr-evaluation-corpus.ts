import { resolve } from "node:path";
import { loadAnnoCtrEvaluationCorpus } from "../src/evaluation/annoCtrCorpus.ts";

const output = Bun.argv[2];
if (!output) throw new Error("Usage: bun scripts/prepare-annoctr-evaluation-corpus.ts <output.jsonl>");

const records = await loadAnnoCtrEvaluationCorpus();
const destination = resolve(output);
await Bun.write(destination, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
console.log(JSON.stringify({ destination, recordCount: records.length, validationCount: records.filter((record) => record.datasetSplit === "validation").length, testCount: records.filter((record) => record.datasetSplit === "test").length }));
