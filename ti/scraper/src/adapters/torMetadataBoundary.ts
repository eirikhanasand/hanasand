import { DARKNET_METADATA_NETWORK_CONFIGS } from "./darknetMetadataConstants.ts";

type MetadataFetcher = (input: string | URL | Request, init?: RequestInit & { proxy?: string }) => Promise<Response>;
type BoundaryOptions = { proxyUrl: string; fetcher?: MetadataFetcher };

export class TorMetadataHttpBoundary {
  readonly id = "tor-approved-metadata-proxy";
  readonly network = "tor";
  readonly accessMethod = "approved_proxy";
  readonly config = DARKNET_METADATA_NETWORK_CONFIGS.tor;
  private readonly fetcher: MetadataFetcher;
  private readonly proxyUrl: string;

  constructor(options: BoundaryOptions) {
    const proxy = new URL(options.proxyUrl);
    if (!["http:", "https:"].includes(proxy.protocol) || proxy.username || proxy.password) throw new Error("Tor metadata proxy must be an HTTP(S) URL without embedded credentials");
    this.proxyUrl = proxy.toString();
    this.fetcher = options.fetcher ?? fetch;
  }

  async fetchMetadata(request: any) {
    let target = approvedOnionUrl(request.url);
    const maxBytes = Math.min(Math.max(1_024, Number(request.maxBytes ?? this.config.maxMetadataBytes)), this.config.maxMetadataBytes);
    for (let redirects = 0; redirects <= 2; redirects++) {
      const response = await this.fetcher(target.toString(), {
        headers: { "user-agent": "hanasand-ti-metadata/1.0" },
        redirect: "manual",
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        proxy: this.proxyUrl
      } as RequestInit & { proxy: string });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 2) throw new Error("Tor metadata redirect limit exceeded");
        target = approvedOnionUrl(new URL(location, target).toString());
        continue;
      }
      if (!response.ok) throw Object.assign(new Error(`Tor metadata HTTP ${response.status}`), { httpStatus: response.status });
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
      if (contentType && !["text/html", "application/xhtml+xml", "text/plain"].includes(contentType)) throw new Error(`Tor metadata unsupported media type: ${contentType}`);
      const body = await boundedText(response, maxBytes);
      return metadataFromHtml(body.text, request.actorName);
    }
    throw new Error("Tor metadata redirect limit exceeded");
  }
}

function approvedOnionUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !/^[a-z2-7]{56}\.onion$/i.test(url.hostname)) throw new Error("Tor metadata target must be a v3 onion service");
  return url;
}

async function boundedText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", truncated: false };
  const decoder = new TextDecoder();
  let text = "", bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const remaining = maxBytes - bytes;
    if (remaining <= 0) { await reader.cancel(); return { text: text + decoder.decode(), truncated: true }; }
    const accepted = chunk.value.byteLength > remaining ? chunk.value.subarray(0, remaining) : chunk.value;
    bytes += accepted.byteLength;
    text += decoder.decode(accepted, { stream: true });
    if (accepted.byteLength < chunk.value.byteLength) { await reader.cancel(); return { text: text + decoder.decode(), truncated: true }; }
  }
  return { text: text + decoder.decode(), truncated: false };
}

function metadataFromHtml(html: string, actorName?: string) {
  const title = clean(tag(html, "title") || tag(html, "h1")).slice(0, 300) || undefined;
  const visible = clean(html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, " "));
  const description = clean(meta(html, "description") || visible).slice(0, 1_000) || undefined;
  return {
    title,
    description,
    actorName,
    victimName: labeled(description, ["victim", "company", "organization"]),
    claimedSector: labeled(description, ["sector", "industry"]),
    claimedCountry: labeled(description, ["country", "location"]),
    claimedDataType: labeled(description, ["data type", "data"]),
    sourceTimestamp: time(html),
    links: [...html.matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]).filter((value) => /^https?:\/\/[a-z2-7]{56}\.onion(?:\/|$)/i.test(value)).slice(0, 20)
  };
}

function tag(html: string, name: string): string { return html.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? ""; }
function meta(html: string, name: string): string { const element = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]).find((value) => new RegExp(`(?:name|property)=["'](?:og:)?${name}["']`, "i").test(value)); return element?.match(/content=["']([^"']*)["']/i)?.[1] ?? ""; }
function time(html: string): string | undefined { const value = html.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]; return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined; }
function labeled(text: string | undefined, labels: string[]): string | undefined { if (!text) return undefined; const match = text.match(new RegExp(`(?:${labels.join("|")})\\s*[:\\-]\\s*([^|;\\n]{2,120})`, "i")); return match?.[1]?.trim(); }
function clean(value: string): string { return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim(); }
