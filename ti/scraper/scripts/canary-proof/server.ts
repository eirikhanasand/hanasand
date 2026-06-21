import { startApiServer } from "../../src/api/server.ts";

export function canaryResponse(url: string): Response {
  if (url.includes("microsoft.com")) {
    return rss("APT42 credential theft infrastructure observed", "APT42 targeted public sector victims with phishing infrastructure and malware delivery.");
  }
  if (url.includes("cloud.google.com/blog/products/identity-security")) {
    return rss("Turla Snake malware activity", "Turla operators used Snake malware against government victims with command infrastructure.");
  }
  if (url.includes("cloud.google.com/blog/topics/threat-intelligence")) {
    return rss("Turla and APT42 public research roundup", "Public threat research references Turla, APT42, phishing, malware, and defensive indicators.");
  }
  return rss("CVE-2026-11111 public advisory", "Public advisory references CVE-2026-11111 exploitation and malware activity.");
}

export function startProofServer(options: Parameters<typeof startApiServer>[0]) {
  const configured = Number.parseInt(Bun.env.TI_CANARY_PROOF_PORT ?? "", 10);
  const candidates = Number.isFinite(configured)
    ? [configured]
    : Array.from({ length: 20 }, (_, index) => 18_097 + index);
  let lastError: unknown;
  for (const port of candidates) {
    try {
      return startApiServer({ ...options, port });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("unable to start canary proof server");
}

function rss(title: string, description: string): Response {
  return new Response(`
    <rss><channel><item>
      <title>${title}</title>
      <link>https://example.test/canary/${encodeURIComponent(title.toLowerCase().replaceAll(" ", "-"))}</link>
      <description>${description}</description>
      <pubDate>Sun, 24 May 2026 11:01:00 GMT</pubDate>
    </item></channel></rss>
  `, { status: 200, headers: { "content-type": "application/rss+xml" } });
}
