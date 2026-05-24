import { assertLiveSearchDeployVerification, verifyLiveSearchDeployProbe } from "../src/ops/liveSearch.ts";

const query = "Scattered Spider";
const publicTiUrl = process.env.PUBLIC_TI_SEARCH_URL ?? `https://hanasand.com/ti?q=${encodeURIComponent(query)}`;
const apiSearchUrl = process.env.PUBLIC_TI_API_SEARCH_URL ?? "https://api.hanasand.com/api/ti/search";

const [publicTi, apiSearch] = await Promise.all([
  fetchText(publicTiUrl),
  fetchJsonOrText(apiSearchUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query })
  })
]);
const verification = verifyLiveSearchDeployProbe({
  publicTi,
  apiSearch
});

for (const check of verification.checks) {
  console.log(JSON.stringify({
    event: "live_search_deploy.check",
    name: check.name,
    ok: check.ok,
    message: check.message
  }));
}

assertLiveSearchDeployVerification(verification);

async function fetchText(url: string): Promise<{ url: string; status: number; body: string }> {
  const response = await fetch(url);
  return {
    url,
    status: response.status,
    body: await response.text()
  };
}

async function fetchJsonOrText(url: string, init?: RequestInit): Promise<{ url: string; status: number; json?: unknown; body?: string }> {
  const response = await fetch(url, init);
  const text = await response.text();
  try {
    return { url, status: response.status, json: JSON.parse(text) };
  } catch {
    return { url, status: response.status, body: text };
  }
}
