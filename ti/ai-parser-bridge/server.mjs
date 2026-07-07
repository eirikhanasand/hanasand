const PORT = Number(process.env.HANASAND_AI_BRIDGE_PORT ?? "18181");
const OPENAI_BASE = process.env.HANASAND_AI_OPENAI_BASE ?? "http://127.0.0.1:18081";
const MODEL = process.env.HANASAND_AI_MODEL ?? "hanasand";
const TRANSPORT = process.env.HANASAND_AI_TRANSPORT ?? "tools-ai";
const TOOLS_AI_URL = process.env.HANASAND_AI_TOOLS_API ?? "http://api:8080/api/tools/ai";
const MODELS_URL = process.env.HANASAND_AI_MODELS_URL ?? "http://api:8080/api/ai/models";

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/ready")) return health(url.pathname === "/health");
    if (request.method === "GET" && url.pathname === "/v1/models") return proxyModels();
    if (request.method === "POST" && url.pathname === "/v1/parse/exposure-claim") return parseExposureClaim(request);
    return json({ error: "not_found" }, 404);
  }
});

console.log(JSON.stringify({
  service: "hanasand-ai-parser-bridge",
  status: "listening",
  port: server.port,
  transport: TRANSPORT,
  openaiBase: OPENAI_BASE,
  toolsAiUrl: TOOLS_AI_URL,
  model: MODEL
}));

async function health(liveness = false) {
  const started = Date.now();
  if (TRANSPORT === "tools-ai") return toolsAiHealth(started, liveness);

  try {
    const response = await fetch(upstreamUrl("/v1/models"), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });
    const body = await safeJson(response);
    const models = Array.isArray(body?.data) ? body.data.map((item) => item.id).filter(Boolean) : [];
    const modelAvailable = models.length === 0 || models.includes(MODEL);
    return json({
      schemaVersion: "hanasand.ai_parser_bridge.health.v1",
      generatedAt: new Date().toISOString(),
      status: response.ok && modelAvailable ? "ready" : "blocked",
      upstream: upstreamUrl("/v1/models"),
      upstreamHttpStatus: response.status,
      model: MODEL,
      modelAvailable,
      models,
      latencyMs: Date.now() - started
    }, liveness ? 200 : response.ok && modelAvailable ? 200 : 502);
  } catch (error) {
    return json({
      schemaVersion: "hanasand.ai_parser_bridge.health.v1",
      generatedAt: new Date().toISOString(),
      status: "blocked",
      upstream: upstreamUrl("/v1/models"),
      model: MODEL,
      blocker: messageOf(error),
      latencyMs: Date.now() - started
    }, liveness ? 200 : 502);
  }
}

async function toolsAiHealth(started, liveness = false) {
  try {
    const response = await fetch(MODELS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    const body = await safeJson(response);
    const models = Array.isArray(body?.connected) ? body.connected.map((item) => item.name || item.modelId).filter(Boolean) : [];
    const modelAvailable = models.includes(MODEL) || models.length > 0;
    return json({
      schemaVersion: "hanasand.ai_parser_bridge.health.v1",
      generatedAt: new Date().toISOString(),
      status: response.ok && modelAvailable ? "ready" : "blocked",
      transport: "tools-ai",
      modelsEndpoint: MODELS_URL,
      toolsAiEndpoint: TOOLS_AI_URL,
      upstreamHttpStatus: response.status,
      model: MODEL,
      modelAvailable,
      models,
      latencyMs: Date.now() - started
    }, liveness ? 200 : response.ok && modelAvailable ? 200 : 502);
  } catch (error) {
    return json({
      schemaVersion: "hanasand.ai_parser_bridge.health.v1",
      generatedAt: new Date().toISOString(),
      status: "blocked",
      transport: "tools-ai",
      modelsEndpoint: MODELS_URL,
      toolsAiEndpoint: TOOLS_AI_URL,
      model: MODEL,
      blocker: messageOf(error),
      latencyMs: Date.now() - started
    }, liveness ? 200 : 502);
  }
}

async function proxyModels() {
  if (TRANSPORT === "tools-ai") {
    try {
      const response = await fetch(MODELS_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
      });
    } catch (error) {
      return json({ error: messageOf(error), modelsEndpoint: MODELS_URL }, 502);
    }
  }

  try {
    const response = await fetch(upstreamUrl("/v1/models"), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
    });
  } catch (error) {
    return json({ error: messageOf(error) }, 502);
  }
}

async function parseExposureClaim(request) {
  const started = Date.now();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const item = body?.item ?? body;
  const hints = deterministicHints(item);
  let completion;
  try {
    completion = TRANSPORT === "tools-ai"
      ? await callToolsAi(item, hints)
      : await callOpenAi(item, hints);
  } catch (error) {
    return json({
      error: "upstream_ai_unavailable",
      blocker: messageOf(error),
      upstream: TRANSPORT === "tools-ai" ? TOOLS_AI_URL : upstreamUrl("/v1/chat/completions"),
      model: MODEL
    }, 502);
  }

  const content = completion?.message ?? completion?.choices?.[0]?.message?.content ?? completion?.choices?.[0]?.text ?? "";
  const parsed = parseJsonObject(content) ?? {};
  const actor = cleanActorName(parsed.actor ?? parsed.threatActor ?? hints.actor ?? item?.actor ?? item?.sourceName ?? "Unknown actor");
  const company = clean(parsed.company ?? parsed.victimName ?? parsed.victim ?? hints.company ?? item?.company ?? item?.victimName ?? "");
  const claimedData = clean(parsed.claimedData ?? parsed.dataClaim ?? hints.claimedData ?? item?.claimedData ?? "new victim claim");
  const country = clean(parsed.country ?? parsed.claimedCountry ?? hints.country ?? item?.country ?? item?.claimedCountry ?? "");
  const confidence = clamp(Number(parsed.confidence ?? (company && actor !== "Unknown actor" ? 0.84 : 0.66)));
  const summary = clean(parsed.summary ?? hints.summary ?? item?.title ?? "").slice(0, 320);

  return json({
    actor,
    company,
    victimName: company,
    claimedData,
    country,
    claimType: clean(parsed.claimType ?? item?.claimType ?? "ransomware_victim_publication"),
    claimTime: parsed.claimTime ?? item?.publishedAt ?? item?.capturedAt ?? new Date().toISOString(),
    summary,
    confidence,
    aiCalled: true,
    aiProvider: TRANSPORT === "tools-ai" ? "hanasand-tools-ai" : "hanasand-inspur-openai-compatible",
    aiModel: completion?.model ?? MODEL,
    aiLatencyMs: Date.now() - started,
    aiResponseId: completion?.conversationId ?? completion?.id,
    parserQuality: confidence >= 0.82 ? "high" : confidence >= 0.68 ? "medium" : "needs_review"
  });
}

async function callToolsAi(item, hints) {
  const prompt = [
    "Parse this public CTI exposure item for a SOC exposure queue.",
    "Return only a JSON object. No markdown.",
    "Required keys: actor, company, claimedData, country, claimType, claimTime, summary, confidence.",
    "Use metadata-only wording. Do not include leaked content, credentials, private data, or raw file names.",
    "",
    JSON.stringify({ item: compactItem(item), fallbackHints: hints }).slice(0, 5000)
  ].join("\n");

  const response = await fetch(TOOLS_AI_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      maxTokens: 420,
      billingMode: "standard",
      metadata: {
        source: "ti-exposure-parser-bridge",
        parserUse: "metadata-only-exposure-claim"
      }
    }),
    signal: AbortSignal.timeout(Number(process.env.HANASAND_AI_TOOLS_TIMEOUT_MS ?? "20000"))
  });
  if (!response.ok) throw new Error(`tools-ai returned HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return response.json();
}

async function callOpenAi(item, hints) {
  const title = clean(item?.title ?? "");
  const text = clean(item?.text ?? item?.rawText ?? item?.body ?? "");
  const source = clean(item?.sourceName ?? item?.sourceId ?? item?.sourceUrl ?? item?.url ?? "");
  const prompt = [
    "Extract metadata-only exposure claim fields from this public CTI/news/victim-feed item.",
    "Return only compact JSON with keys actor, company, claimedData, country, claimType, claimTime, summary, confidence.",
    "Do not include leaked content, credentials, file names, or raw private material.",
    "",
    `source: ${source.slice(0, 240)}`,
    `title: ${title.slice(0, 600)}`,
    `text: ${text.slice(0, 3000)}`,
    `fallback_hints: ${JSON.stringify(hints).slice(0, 800)}`
  ].join("\n");

  const response = await fetch(upstreamUrl("/v1/chat/completions"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: "You are Hanasand AI. You parse public threat-intelligence exposure claims into strict JSON for a SOC queue."
        },
        { role: "user", content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.HANASAND_AI_UPSTREAM_TIMEOUT_MS ?? "11000"))
  });
  if (!response.ok) throw new Error(`upstream returned HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return response.json();
}

function deterministicHints(item) {
  const text = clean([item?.title, item?.text, item?.rawText, item?.body].filter(Boolean).join("\n"));
  const victim =
    clean(item?.company ?? item?.victimName) ||
    match(text, /\bvictim\s*:?\s+([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})/i) ||
    match(text, /\b(?:listed|lists|added|adds|published|claims?|target(?:ed|ing))\s+(?:victim\s*:?\s*)?([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})/i) ||
    match(text, /:\s*([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})$/);
  const actor = cleanActorName(item?.actor) || match(text, /^([A-Z][A-Za-z0-9_. -]{2,50})\b/) || cleanActorName(item?.sourceName) || "Unknown actor";
  const claimedData = clean(item?.claimedData) || match(text, /\b(\d+(?:\.\d+)?\s*(?:GB|TB|MB)\s+(?:claimed|leaked|stolen|exfiltrated|data))/i) || "new victim claim";
  const country = clean(item?.country ?? item?.claimedCountry) || match(text, /\bcountry\s*:?\s*([A-Z][A-Za-z .'-]{1,60}|[A-Z]{2})\b/i);
  return {
    actor,
    company: victim,
    claimedData,
    country,
    summary: text.slice(0, 300),
    confidence: victim && actor !== "Unknown actor" ? 0.78 : 0.58
  };
}

function compactItem(item) {
  return {
    sourceId: item?.sourceId,
    sourceName: item?.sourceName,
    sourceUrl: item?.sourceUrl,
    url: item?.url,
    title: clean(item?.title ?? "").slice(0, 600),
    text: clean(item?.text ?? item?.rawText ?? item?.body ?? "").slice(0, 3000),
    actor: item?.actor,
    company: item?.company,
    victimName: item?.victimName,
    claimedData: item?.claimedData,
    country: item?.country,
    claimedCountry: item?.claimedCountry,
    capturedAt: item?.capturedAt,
    publishedAt: item?.publishedAt
  };
}

function upstreamUrl(path) {
  return new URL(path, OPENAI_BASE).toString();
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function parseJsonObject(text) {
  const value = String(text ?? "").trim();
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

function match(text, regex) {
  return clean(text.match(regex)?.[1] ?? "");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").replace(/[.。]+$/, "").trim();
}

function cleanActorName(value) {
  return clean(value).replace(/\s+(?:has just published a new victim|claims? victim|claim(?:ed|s)? victim|listed victim|added victim|published victim)\b.*$/i, "");
}

function clamp(value) {
  if (!Number.isFinite(value)) return 0.58;
  return Math.max(0, Math.min(1, value));
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
