export interface ExtractionFixture {
  name: string;
  rawText: string;
  language?: string;
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
}

export const extractionCorpus: ExtractionFixture[] = [
  {
    name: "clear-web ransomware report",
    rawText: [
      "LockBit ransomware exploited CVE-2025-12345 against Northwind Health in the United States.",
      "Analysts observed hxxps://payload.evil-example[.]com/dropper and SHA256",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa."
    ].join(" ")
  },
  {
    name: "metadata-only leak claim",
    rawText: "actor: Akira\nvictim: Fjord Energy AS\nsector: energy\ncountry: Norway\ndata type: contracts",
    language: "en",
    sensitive: true,
    metadata: { safeExcerpt: "Akira claimed Fjord Energy AS in Norway." }
  },
  {
    name: "ambiguous infrastructure",
    rawText: "The campaign referenced 10.0.0.4, 2001:db8::10, qakbot, and customer: Example Telecom."
  }
];
