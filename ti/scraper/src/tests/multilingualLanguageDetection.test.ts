import { describe, expect, test } from "bun:test";
import { detectPublicReportLanguage } from "../adapters/multilingualReportHandoff.ts";

describe("multilingual language detection", () => {
  test("remains deterministic for supported fixture scripts", () => {
    expect(detectPublicReportLanguage("Группа описала атаку и индикаторы.").language).toBe("ru");
    expect(detectPublicReportLanguage("报告描述了攻击活动和基础设施。").language).toBe("zh");
    expect(detectPublicReportLanguage("گزارش درباره حمله توضیح می‌دهد.").language).toBe("fa");
    expect(detectPublicReportLanguage("Nasjonal trusselaktør utnyttet sårbarhet.").language).toBe("nb");
    expect(detectPublicReportLanguage("La amenaza explotó una vulnerabilidad.").language).toBe("es");
    expect(detectPublicReportLanguage("Threat advisory describes malware indicators.").language).toBe("en");
    expect(detectPublicReportLanguage("Threat advisory includes индикаторы.").language).toBe("mixed");
  });
});
