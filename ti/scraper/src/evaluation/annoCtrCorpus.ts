import { createHash } from "node:crypto";
import { publicAdvisoryFetcher } from "../api/exposureQueueRoutes.ts";

export const ANNOCTR_LABEL_TYPES = ["actor", "malware", "ttp", "sector"] as const;

const COMMIT = "d510b6949e1938d47c93a43eedd562dc538439dc" as const;
export const ANNOCTR_CORPUS_FILES = {
  validation: {
    upstreamSplit: "dev",
    sha256: "04908a004a9d13c51f6c9a2c0c555bb17b96998ac07069cc8ee440f01c7e0957",
    url: `https://raw.githubusercontent.com/boschresearch/anno-ctr-lrec-coling-2024/${COMMIT}/AnnoCTR/ner_bio/dev.bio`
  },
  test: {
    upstreamSplit: "test",
    sha256: "0e20cfd2b031a37f2d767c8b3df589ac2b69a476b7ecb3ae65e77188520fd176",
    url: `https://raw.githubusercontent.com/boschresearch/anno-ctr-lrec-coling-2024/${COMMIT}/AnnoCTR/ner_bio/test.bio`
  }
} as const;

export type AnnoCtrSentence = {
  datasetSplit: keyof typeof ANNOCTR_CORPUS_FILES;
  recordId: string;
  text: string;
  labels: Record<(typeof ANNOCTR_LABEL_TYPES)[number], string[]>;
  spans: Array<{ sourceLabel: string; labelType: (typeof ANNOCTR_LABEL_TYPES)[number]; value: string }>;
  provenance: {
    corpus: "boschresearch/anno-ctr-lrec-coling-2024";
    commit: typeof COMMIT;
    upstreamSplit: string;
    sourceUrl: string;
    sourceSha256: string;
    license: "CC-BY-SA-4.0";
    annotationOrigin: "external_human_annotation";
  };
};

export async function loadAnnoCtrEvaluationCorpus(configuredFetch?: typeof fetch): Promise<AnnoCtrSentence[]> {
  const fetcher = publicAdvisoryFetcher(configuredFetch, 30_000);
  const splits = await Promise.all(Object.entries(ANNOCTR_CORPUS_FILES).map(async ([datasetSplit, file]) => {
    const response = await fetcher(file.url, { headers: { "user-agent": "Hanasand-Offline-Evaluation-Corpus/1.0" } });
    if (!response.ok) throw new Error(`AnnoCTR ${file.upstreamSplit} fetch failed with HTTP ${response.status}`);
    const body = await response.text();
    if (sha256(body) !== file.sha256) throw new Error(`AnnoCTR ${file.upstreamSplit} checksum mismatch`);
    return parseAnnoCtrBio(body, file.upstreamSplit).map((record) => ({
      ...record,
      datasetSplit: datasetSplit as keyof typeof ANNOCTR_CORPUS_FILES,
      provenance: {
        corpus: "boschresearch/anno-ctr-lrec-coling-2024" as const,
        commit: COMMIT as typeof COMMIT,
        upstreamSplit: file.upstreamSplit,
        sourceUrl: file.url,
        sourceSha256: file.sha256,
        license: "CC-BY-SA-4.0" as const,
        annotationOrigin: "external_human_annotation" as const
      }
    }));
  }));
  return splits.flat();
}

export function parseAnnoCtrBio(body: string, upstreamSplit = "test") {
  const records: Array<Omit<AnnoCtrSentence, "datasetSplit" | "provenance">> = [];
  let documentIndex = -1, sentenceIndex = 0, rows: string[][] = [];
  const flush = () => {
    if (!rows.length) return;
    if (documentIndex < 0) throw new Error("AnnoCTR sentence appeared before DOCSTART");
    const spans = [1, 4, 5].flatMap((column) => bioSpans(rows, column)).flatMap((span) => {
      const labelType = mappedLabelType(span.sourceLabel);
      return labelType ? [{ ...span, labelType }] : [];
    });
    const uniqueSpans = [...new Map(spans.map((span) => [`${span.labelType}\0${normalize(span.value)}`, span])).values()];
    const labels = Object.fromEntries(ANNOCTR_LABEL_TYPES.map((labelType) => [
      labelType,
      [...new Map(uniqueSpans.filter((span) => span.labelType === labelType).map((span) => [normalize(span.value), span.value])).values()]
    ])) as AnnoCtrSentence["labels"];
    records.push({ recordId: `${upstreamSplit}:doc-${documentIndex}:sentence-${sentenceIndex++}`, text: joinTokens(rows.map((row) => row[0])), labels, spans: uniqueSpans });
    rows = [];
  };

  for (const line of body.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) { flush(); continue; }
    const columns = line.split("\t");
    if (columns[0] === "<DOCSTART>") { flush(); documentIndex++; sentenceIndex = 0; continue; }
    if (columns.length < 7) throw new Error(`AnnoCTR row has ${columns.length} columns; expected 7`);
    rows.push(columns);
  }
  flush();
  if (!records.length) throw new Error("AnnoCTR corpus contained no sentences");
  return records;
}

function bioSpans(rows: string[][], column: number) {
  const spans: Array<{ sourceLabel: string; value: string }> = [];
  let label = "", tokens: string[] = [];
  const flush = () => { if (label && tokens.length) spans.push({ sourceLabel: label, value: joinTokens(tokens) }); label = ""; tokens = []; };
  for (const row of rows) {
    const match = String(row[column] ?? "O").match(/^([BI])-(.+)$/);
    if (!match) { flush(); continue; }
    if (match[1] === "B" || match[2] !== label) flush();
    label = match[2]; tokens.push(row[0]);
  }
  flush();
  return spans;
}

function mappedLabelType(label: string): (typeof ANNOCTR_LABEL_TYPES)[number] | undefined {
  const mapped: Record<string, (typeof ANNOCTR_LABEL_TYPES)[number]> = { GROUP: "actor", MALWARE: "malware", TACTIC: "ttp", TECHNIQUE: "ttp", SECTOR: "sector" };
  return mapped[label];
}

function joinTokens(tokens: string[]) {
  return tokens.join(" ").replace(/\s+([,.;:!?%\)\]\}])/g, "$1").replace(/([\(\[\{])\s+/g, "$1").replace(/\s+([’'])\s+/g, "$1").replace(/\s+/g, " ").trim();
}

function normalize(value: string) { return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
