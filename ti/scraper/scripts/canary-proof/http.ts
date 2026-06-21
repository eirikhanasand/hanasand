import type { JsonObject } from "./types.ts";

export async function postJson(base: string, path: string, body: JsonObject): Promise<JsonObject> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(path, response);
}

export async function getJson(base: string, path: string): Promise<JsonObject> {
  return parseResponse(path, await fetch(`${base}${path}`));
}

async function parseResponse(path: string, response: Response): Promise<JsonObject> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text}`);
  return JSON.parse(text) as JsonObject;
}
