const API_WS = process.env.HANASAND_AI_CLIENT_API_WS ?? "ws://127.0.0.1:8080/api/client/ws/gpt";
const OPENAI_BASE = process.env.HANASAND_AI_OPENAI_BASE ?? "http://127.0.0.1:18081";
const MODEL = process.env.HANASAND_AI_MODEL ?? "hanasand";
const CLIENT_NAME = process.env.HANASAND_AI_CLIENT_NAME ?? "hanasand-inspur";
const HEALTH_PORT = Number(process.env.HANASAND_AI_CLIENT_HEALTH_PORT ?? "18182");

let socket;
let connected = false;
let lastError = null;
let lastPromptAt = null;
let lastCompletionAt = null;
let lastModelCheck = null;
let heartbeat;
let modelCheckInFlight = false;
let modelHealth = { ready: false, blocker: "not_checked", checkedAt: null };
let reconnectTimer;
let reconnectDelayMs = 2_000;

Bun.serve({
  hostname: "0.0.0.0",
  port: HEALTH_PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/health" && url.pathname !== "/ready") return json({ error: "not_found" }, 404);
    refreshModelHealth();
    const ready = connected && modelHealth.ready;
    return json({
      schemaVersion: "hanasand.ai_model_client.health.v1",
      generatedAt: new Date().toISOString(),
      status: ready ? "ready" : "blocked",
      apiWs: API_WS,
      openaiBase: OPENAI_BASE,
      model: MODEL,
      clientName: CLIENT_NAME,
      connected,
      lastPromptAt,
      lastCompletionAt,
      lastError,
      modelHealth
    }, url.pathname === "/health" ? 200 : ready ? 200 : 503);
  }
});

connect();
refreshModelHealth();
setInterval(refreshModelHealth, 30_000);

function connect() {
  clearInterval(heartbeat);
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  connected = false;

  const ws = new WebSocket(API_WS);
  socket = ws;

  ws.addEventListener("open", () => {
    connected = true;
    reconnectDelayMs = 2_000;
    lastError = null;
    refreshModelHealth();
    sendClientUpdate("idle");
    heartbeat = setInterval(() => sendClientUpdate("idle"), 10_000);
  });

  ws.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }

    if (message?.type === "prompt_request") {
      void handlePromptRequest(message);
    }
  });

  ws.addEventListener("close", () => scheduleReconnect(ws, "websocket closed"));
  ws.addEventListener("error", () => scheduleReconnect(ws, "websocket error"));
}

function scheduleReconnect(source, error) {
  if (source !== socket || reconnectTimer) return;
  if (error) lastError = error;
  connected = false;
  clearInterval(heartbeat);
  const delay = reconnectDelayMs;
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!connected) connect();
  }, delay);
}

async function handlePromptRequest(request) {
  const conversationId = request.conversationId || `tools-${crypto.randomUUID()}`;
  const started = Date.now();
  lastPromptAt = new Date().toISOString();
  sendClientUpdate("generating", { conversationId });
  send({
    type: "prompt_started",
    conversationId,
    clientName: CLIENT_NAME,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(new URL("/v1/chat/completions", OPENAI_BASE), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: Array.isArray(request.messages) ? request.messages : [],
        temperature: Number.isFinite(Number(request.temperature)) ? Number(request.temperature) : 0,
        max_tokens: Math.max(16, Math.min(Number(request.maxTokens) || 512, 4096))
      }),
      signal: AbortSignal.timeout(Number(process.env.HANASAND_AI_CLIENT_TIMEOUT_MS ?? "45000"))
    });

    if (!response.ok) {
      throw new Error(`model returned HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.text ?? "";
    const usage = body?.usage ?? {};
    lastCompletionAt = new Date().toISOString();
    lastError = null;
    send({
      type: "prompt_complete",
      conversationId,
      clientName: CLIENT_NAME,
      content,
      metrics: {
        conversationId,
        status: "idle",
        currentTokens: 0,
        maxTokens: Number(request.maxTokens) || 0,
        promptTokens: Number(usage.prompt_tokens) || 0,
        generatedTokens: Number(usage.completion_tokens) || 0,
        contextTokens: Number(usage.total_tokens) || 0,
        contextMaxTokens: 32768,
        tps: Number(usage.completion_tokens) > 0 ? Number((Number(usage.completion_tokens) / Math.max((Date.now() - started) / 1000, 0.001)).toFixed(2)) : 0,
        lastUpdated: lastCompletionAt,
        lastError: null
      },
      timestamp: new Date().toISOString()
    });
    sendClientUpdate("idle");
  } catch (error) {
    lastError = messageOf(error);
    send({
      type: "prompt_error",
      conversationId,
      clientName: CLIENT_NAME,
      error: lastError,
      timestamp: new Date().toISOString()
    });
    sendClientUpdate("error", { lastError });
  }
}

function sendClientUpdate(status, overrides = {}) {
  send({
    type: "update",
    client: {
      name: CLIENT_NAME,
      displayName: "Hanasand AI on Inspur",
      modelId: MODEL,
      profile: "inspur-gpu-openai-compatible",
      ram: [],
      cpu: [],
      gpu: [],
      model: {
        conversationId: overrides.conversationId ?? null,
        status,
        currentTokens: 0,
        maxTokens: 32768,
        promptTokens: 0,
        generatedTokens: 0,
        contextTokens: 0,
        contextMaxTokens: 32768,
        tps: 0,
        lastUpdated: new Date().toISOString(),
        lastError: overrides.lastError ?? null
      }
    }
  });
}

function send(payload) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

async function checkModel() {
  try {
    const response = await fetch(new URL("/v1/models", OPENAI_BASE), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });
    const body = await response.json().catch(() => undefined);
    const models = Array.isArray(body?.data) ? body.data.map((item) => item.id).filter(Boolean) : [];
    const modelAvailable = models.includes(MODEL) || models.length === 0;
    lastModelCheck = new Date().toISOString();
    return {
      ready: response.ok && modelAvailable,
      httpStatus: response.status,
      models,
      modelAvailable,
      checkedAt: lastModelCheck
    };
  } catch (error) {
    return {
      ready: false,
      blocker: messageOf(error),
      checkedAt: new Date().toISOString()
    };
  }
}

function refreshModelHealth() {
  if (modelCheckInFlight) return;
  modelCheckInFlight = true;
  void checkModel()
    .then((health) => {
      modelHealth = health;
    })
    .finally(() => {
      modelCheckInFlight = false;
    });
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
