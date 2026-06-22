import type { MarketplaceRow, MonetizationSummary } from "./types.ts";
import { outputRecord } from "./outputRecord.ts";
import { apifyApiBase, apifyHeaders, ensureDir } from "./utils.ts";

const DATASET_PUSH_BATCH_SIZE = 250;

export async function writeOutputs(rows: MarketplaceRow[], monetizationSummary: MonetizationSummary) {
  const record = outputRecord(rows, monetizationSummary);
  const summaryRecord = outputSummaryRecord(record);

  await pushRemoteApifyOutputs(rows, summaryRecord);

  const outputStoreDir = process.env.APIFY_OUTPUT_KEY_VALUE_STORE_DIR;
  if (outputStoreDir) {
    await ensureDir(outputStoreDir);
    await Bun.write(`${outputStoreDir}/OUTPUT.json`, JSON.stringify(summaryRecord, null, 2));
  }

  const localStorageDir = process.env.APIFY_LOCAL_STORAGE_DIR;
  if (localStorageDir) {
    const datasetDir = `${localStorageDir}/datasets/default`;
    const keyValueDir = `${localStorageDir}/key_value_stores/default`;
    await ensureDir(datasetDir);
    await ensureDir(keyValueDir);
    await Bun.write(`${keyValueDir}/OUTPUT.json`, JSON.stringify(summaryRecord, null, 2));
    await Promise.all(rows.map((row, index) => {
      const id = String(index + 1).padStart(9, "0");
      return Bun.write(`${datasetDir}/${id}.json`, JSON.stringify(row, null, 2));
    }));
  }

  if (!process.env.APIFY_ACTOR_RUN_ID) {
    await Bun.write("output.json", JSON.stringify(rows, null, 2));
  }
}

async function pushRemoteApifyOutputs(rows: MarketplaceRow[], summaryRecord: OutputSummaryRecord) {
  if (!process.env.APIFY_TOKEN) return;

  const storeId = process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
  if (storeId) {
    await putKeyValueRecord(storeId, "OUTPUT", summaryRecord);
    await putKeyValueRecord(storeId, "RUN_SUMMARY", summaryRecord);
  }

  const datasetId = process.env.APIFY_DEFAULT_DATASET_ID;
  if (datasetId && rows.length) await pushDatasetRows(datasetId, rows);
}

type OutputRecord = ReturnType<typeof outputRecord>;
type OutputSummaryRecord = Omit<OutputRecord, "rows">;

function outputSummaryRecord(record: OutputRecord): OutputSummaryRecord {
  const { rows: _rows, ...summaryRecord } = record;
  return summaryRecord;
}

async function putKeyValueRecord(storeId: string, key: string, record: OutputSummaryRecord) {
  const response = await fetch(`${apifyApiBase()}/v2/key-value-stores/${storeId}/records/${key}`, {
    method: "PUT",
    headers: {
      ...apifyHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error(await apifyResponseError(`Apify ${key} record write`, response));
}

async function pushDatasetRows(datasetId: string, rows: MarketplaceRow[]) {
  for (let index = 0; index < rows.length; index += DATASET_PUSH_BATCH_SIZE) {
    const batch = rows.slice(index, index + DATASET_PUSH_BATCH_SIZE);
    const response = await fetch(`${apifyApiBase()}/v2/datasets/${datasetId}/items`, {
      method: "POST",
      headers: {
        ...apifyHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify(batch)
    });
    if (!response.ok) throw new Error(await apifyResponseError("Apify dataset batch push", response));
  }
}

async function apifyResponseError(label: string, response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return `${label} returned ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`;
}
