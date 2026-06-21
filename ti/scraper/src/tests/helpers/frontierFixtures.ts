import type { SourceRecord } from "../../types.ts";

export const source: SourceRecord = {
  id: "src_test",
  name: "Test Source",
  type: "static_web",
  url: "https://example.test",
  accessMethod: "public_http",
  status: "active",
  risk: "low",
  trustScore: 0.9,
  crawlFrequencySeconds: 3600,
  legalNotes: "Public test fixture.",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};
