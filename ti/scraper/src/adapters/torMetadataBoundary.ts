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
  const title = safeMetadataText(tag(html, "title") || tag(html, "h1")).slice(0, 300) || undefined;
  const visible = clean(html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, " "));
  const rawDescription = safeMetadataText(meta(html, "description") || visible).slice(0, 1_000) || undefined;
  const victimNames = victimNamesFromHtml(html, actorName);
  const description = clean(victimNames.length ? [title, ...victimNames].filter(Boolean).join(" | ") : rawDescription ?? "").slice(0, 1_000) || undefined;
  return {
    title,
    description,
    actorName,
    victimName: labeled(rawDescription, ["victim", "company", "organization"]) ?? victimNames[0],
    victimNames,
    claimedSector: labeled(rawDescription, ["sector", "industry"]),
    claimedCountry: labeled(rawDescription, ["country", "location"]),
    claimedDataType: labeled(rawDescription, ["data type", "data"]),
    extortionType: labeled(rawDescription, ["extortion type", "extortion"]),
    monetizationPath: labeled(rawDescription, ["monetization path", "monetization", "payment model"]),
    publicityTactic: labeled(rawDescription, ["publicity tactic", "publicity"]),
    publicationStrategy: labeled(rawDescription, ["publication strategy"]),
    victimPressureTactic: labeled(rawDescription, ["victim pressure", "pressure tactic"]),
    buyerSellerCommunication: labeled(rawDescription, ["buyer communication", "seller communication"]),
    intermediaryCommunication: labeled(rawDescription, ["intermediary communication", "broker communication"]),
    profitabilitySignal: labeled(rawDescription, ["profitability signal", "revenue signal"]),
    sourceTimestamp: time(html),
    links: []
  };
}

function victimNamesFromHtml(html: string, actorName?: string): string[] {
  const actor = actorName?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const names = [
    ...[...html.matchAll(/<article\b[^>]*class=["'][^"']*\bnews-item\b[^"']*["'][^>]*>[\s\S]*?<h2\b[^>]*class=["'][^"']*\bheadline\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => clean(match[1])),
    ...[...html.matchAll(/<div\b[^>]*class=["'][^"']*\bpost-title\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map((match) => clean(match[1])),
    ...(["safepay", "blackwater"].includes(actor ?? "") ? [...html.matchAll(/<h5\b[^>]*class=["'][^"']*\bcard-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h5>/gi)].map((match) => clean(match[1])) : []),
    ...(actor === "spacebears" ? [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bcompanies-list__item\b[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map((match) => clean(match[1])) : []),
    ...(actor === "qilin" ? [...html.matchAll(/<([a-z0-9]+)\b[^>]*class=["'][^"']*\bitem_box-title\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => clean(match[2])) : []),
    ...(actor === "nova" ? [...html.matchAll(/<[^>]*class=["'][^"']*\bpost-card\b[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*class=["'][^"']*\blogo\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => clean(match[1])) : []),
    ...(actor === "interlock" ? [...html.matchAll(/<([a-z0-9]+)\b[^>]*class=["'][^"']*\badvert_info_title\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => clean(match[2])) : [])
  ];
  return [...new Set(names.map(safeMetadataText).filter((name) => name.length >= 2 && name.length <= 160 && !name.includes("[redacted-")))].slice(0, 24);
}

function tag(html: string, name: string): string { return html.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? ""; }
function meta(html: string, name: string): string { const element = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]).find((value) => new RegExp(`(?:name|property)=["'](?:og:)?${name}["']`, "i").test(value)); return element?.match(/content=["']([^"']*)["']/i)?.[1] ?? ""; }
function time(html: string): string | undefined { const value = html.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]?.trim(); return value && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined; }
function labeled(text: string | undefined, labels: string[]): string | undefined { if (!text) return undefined; const match = text.match(new RegExp(`(?:${labels.join("|")})\\s*[:\\-]\\s*([^|;\\n]{2,120})`, "i")); return match?.[1]?.trim(); }
function clean(value: string): string { return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim(); }
function safeMetadataText(value: string): string {
  return clean(value)
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/\b[a-z2-7]{56}\.onion(?:\/[^\s"'<>]*)?/gi, "[restricted-locator]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[redacted-email]")
    .replace(/\+?\d(?:[\s().-]*\d){7,}/g, "[redacted-phone]")
    .replace(/\b(?:password|passwd|credential|api[_ -]?key|token|secret)\s*[:=]\s*\S+/gi, "[redacted-secret]");
}
