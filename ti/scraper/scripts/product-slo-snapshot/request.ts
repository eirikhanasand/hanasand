import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export async function requestText(url: URL): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const errors: string[] = [];
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    for (const fn of [requestTextWithNodeHttp, requestTextWithCurl]) {
      try {
        return await fn(url);
      } catch (error) {
        errors.push(`${fn.name} attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await Bun.sleep(250 * attempt);
  }
  throw new Error(errors.join("; "));
}

async function requestTextWithNodeHttp(url: URL): Promise<{ ok: boolean; status: number; bodyText: string }> {
  return await new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "GET",
      headers: { accept: "application/json" }
    }, (response) => {
      const chunks: Uint8Array[] = [];
      response.on("data", (chunk: Uint8Array | string) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, bodyText: Buffer.concat(chunks).toString("utf8") });
      });
    });
    request.setTimeout(10_000, () => request.destroy(new Error("Timed out fetching product SLO endpoint")));
    request.on("error", reject);
    request.end();
  });
}

async function requestTextWithCurl(url: URL): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const process = Bun.spawn(["curl", "-sS", "-w", "\n%{http_code}", url.href], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ]);
  if (exitCode !== 0) throw new Error(stderr.trim() || `curl exited with ${exitCode}`);
  const marker = stdout.lastIndexOf("\n");
  if (marker === -1) throw new Error("curl response did not include HTTP status");
  const status = Number(stdout.slice(marker + 1));
  if (!Number.isFinite(status)) throw new Error(`curl response included invalid HTTP status: ${stdout.slice(marker + 1)}`);
  return { ok: status >= 200 && status < 300, status, bodyText: stdout.slice(0, marker) };
}
