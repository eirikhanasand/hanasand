import { describe, expect, test } from "bun:test";
import { isSellableIntelText } from "../value/sellableIntel.ts";

describe("sellable intelligence freshness", () => {
  test("retains historical actor reporting without relaxing fresh exposure alerts", () => {
    const evidence = { sourceId: "src_actor_report", text: "APT29 launched a credential phishing campaign against diplomatic organizations using a malware backdoor.", publishedAt: "2025-09-01T00:00:00.000Z", now: "2026-07-21T00:00:00.000Z" };
    expect(isSellableIntelText(evidence)).toBe(false);
    expect(isSellableIntelText({ ...evidence, maxAgeDays: 365 })).toBe(true);
  });

  test("accepts current European CERT vulnerability language without accepting generic updates", () => {
    const current = { sourceId: "src_public_cert", publishedAt: "2026-07-22T00:00:00.000Z", now: "2026-07-23T00:00:00.000Z" };
    for (const text of [
      "CERT-Bund meldet mehrere Schwachstellen, die ein Angreifer im Linux Kernel ausnutzen kann.",
      "NCSC heeft meerdere kwetsbaarheden verholpen in Oracle MySQL Server en MySQL Cluster.",
      "CERT Polska wykrył podatność umożliwiającą zdalne wykonanie kodu bez uwierzytelniania.",
      "SI-CERT opozarja na kritično ranljivost, ki napadalcu omogoči prevzem spletnega mesta.",
      "CERT-AGID segnala vulnerabilità critiche sfruttate da un attaccante non autenticato."
    ]) expect(isSellableIntelText({ ...current, text })).toBe(true);
    expect(isSellableIntelText({ ...current, text: "CERT objavlja mesečni pregled dogodkov in organizacijskih novic za obiskovalce." })).toBe(false);
  });
});
