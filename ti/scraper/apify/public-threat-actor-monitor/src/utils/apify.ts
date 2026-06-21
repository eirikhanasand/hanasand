export function apifyEventSkipReason(): string {
  if (!process.env.APIFY_TOKEN) return "missing_apify_token";
  if (!process.env.APIFY_ACTOR_RUN_ID) return "missing_actor_run_id";
  return "not_running_on_apify";
}

export function apifyApiBase(): string {
  return (process.env.APIFY_API_BASE_URL ?? "https://api.apify.com").replace(/\/$/, "");
}

export function apifyHeaders(): Record<string, string> {
  const token = process.env.APIFY_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function ensureDir(path: string) {
  await Bun.spawn(["mkdir", "-p", path]).exited;
}
