import { describe, expect, test } from "bun:test";
import { normalizeCapturedContent } from "../pipeline/captureNormalization.ts";

describe("capture normalization", () => {
  test("keeps a threat report readable and removes application chrome", () => {
    const result = normalizeCapturedContent({
      url: "https://example.com/report",
      html: '<html><head><title>APT29 targets public agencies</title><meta name="author" content="Threat Lab"></head><body><nav>Home Search Login</nav><script>window.WIZ_global_data = {"secret":true}</script><article><h1>APT29 targets public agencies</h1><p>Researchers observed phishing and data theft against government organizations in Norway.</p></article><footer>Cookie settings</footer></body></html>'
    });
    expect(result.status).toBe("normalized");
    expect(result.text).toContain("Researchers observed phishing");
    expect(result.text).not.toContain("WIZ_global_data");
    expect(result.text).not.toContain("Cookie settings");
    expect(result.title).toBe("APT29 targets public agencies");
    expect(result.author).toBe("Threat Lab");
    expect(result.incidentLanguage).toEqual(expect.arrayContaining(["phishing", "data theft"]));
  });

  test("explains a dynamic page that has no readable text", () => {
    const result = normalizeCapturedContent({ body: '<script>window.WIZ_global_data = {"data":true}</script>' });
    expect(result.status).toBe("unparsed");
    expect(result.failureCategory).toBe("dynamic_application_data");
    expect(result.failureReason).toContain("dynamic application data");
  });
});
