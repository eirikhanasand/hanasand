import type { EvidenceStage } from "../../pipeline/intelligenceProfiles.ts";

export interface LiveActorFixture {
  id: string;
  query: string;
  stage: EvidenceStage;
  rawText: string;
}

export const liveActorIntelligenceFixtures: LiveActorFixture[] = [
  {
    id: "apt29-current",
    query: "APT29",
    stage: "captured_page",
    rawText: "Mandiant linked APT29 to credential dumping against Northwind Health in the healthcare sector. First seen 2026-05-22. Infrastructure used https://login-northwind.example.com and CVE-2026-11111."
  },
  {
    id: "scattered-spider-current",
    query: "Scattered Spider",
    stage: "captured_page",
    rawText: "CrowdStrike linked Scattered Spider to sms phishing against Example Telecom in the telecommunications sector. Last seen 2026-05-23."
  },
  {
    id: "volt-typhoon-current",
    query: "Volt Typhoon",
    stage: "public_channel_message",
    rawText: "Public channel message says Volt Typhoon may be using living off the land against Pacific Energy Corp in the energy sector."
  },
  {
    id: "turla-current",
    query: "Turla",
    stage: "captured_page",
    rawText: "Researchers linked Turla to Snake malware and command and control infrastructure at https://snake-c2.example.net against Example Embassy."
  },
  {
    id: "akira-current",
    query: "Akira",
    stage: "metadata_only_claim",
    rawText: "Akira claimed victim: Fjord Energy AS on 2026-05-20."
  },
  {
    id: "muddywater-current",
    query: "MuddyWater",
    stage: "captured_page",
    rawText: "Researchers linked MuddyWater, also known as Seedworm, to spearphishing against Example Ministry in the government sector using PowGoop malware. First seen 2026-05-21."
  },
  {
    id: "shinyhunters-drift",
    query: "ShinyHunters",
    stage: "captured_page",
    rawText: "Researchers linked ShinyHunters and Scattered Spider naming overlap to sms phishing against Example Telecom."
  },
  {
    id: "unknown-random",
    query: "Crimson Pineapple",
    stage: "live_discovery",
    rawText: "Crimson Pineapple appears in a search result snippet, but no source attributes activity, victim, malware, CVE, or infrastructure to the name."
  }
];
