import { describe, expect, test } from "bun:test";
import { assertPublicWebhookTarget, normalizeWebhookUrl } from "../api/organizationRoutes.ts";

describe("webhook outbound target policy", () => {
  test("accepts public HTTP(S) endpoints and blocks credentials and private networks", () => {
    expect(normalizeWebhookUrl("https://hooks.example.com/alerts")).toBe("https://hooks.example.com/alerts");
    for (const target of [
      "https://user:secret@hooks.example.com/alerts",
      "http://localhost/admin",
      "http://api:8080/private",
      "http://127.0.0.1/admin",
      "http://10.0.0.2/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://192.168.1.1/admin",
      "http://172.16.0.2/admin",
      "http://100.64.0.1/admin",
      "http://[::1]/admin",
      "http://[fd00::1]/admin",
      "http://service.internal/admin"
    ]) expect(normalizeWebhookUrl(target)).toBeUndefined();
  });

  test("rejects public hostnames that resolve privately", async () => {
    const privateResolver = async () => [{ address: "127.0.0.1", family: 4 }] as any;
    const publicResolver = async () => [{ address: "203.0.113.10", family: 4 }] as any;
    await expect(assertPublicWebhookTarget("https://hooks.example.com/alerts", privateResolver)).rejects.toThrow("private network");
    await expect(assertPublicWebhookTarget("https://hooks.example.com/alerts", publicResolver)).resolves.toBe("https://hooks.example.com/alerts");
  });
});
