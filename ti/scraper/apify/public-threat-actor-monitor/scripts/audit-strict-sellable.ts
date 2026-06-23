import type { MarketplaceRow } from "../src/types.ts";
import { strictSellableAuditForRows } from "../src/strictSellableAudit.ts";

const inputPath = Bun.argv[2] ?? "output.json";
const outputPath = Bun.argv[3];
const rows = await readRows(inputPath);
const audit = strictSellableAuditForRows(rows);

if (outputPath) await Bun.write(outputPath, JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));

async function readRows(path: string): Promise<MarketplaceRow[]> {
  const parsed = await Bun.file(path).json();
  if (Array.isArray(parsed)) return parsed as MarketplaceRow[];
  if (Array.isArray(parsed.rows)) return parsed.rows as MarketplaceRow[];
  throw new Error(`Strict sellable audit expected an array of rows or an object with rows[] at ${path}`);
}
