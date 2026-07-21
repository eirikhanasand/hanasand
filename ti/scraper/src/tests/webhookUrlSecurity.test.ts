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
      "http://[fe80::1]/admin",
      "http://[::ffff:127.0.0.1]/admin",
      "http://[2001:db8::1]/admin",
      "http://service.internal/admin"
    ]) expect(normalizeWebhookUrl(target)).toBeUndefined();
    expect(normalizeWebhookUrl("https://[2606:4700:7::21d]/alerts")).toBe("https://[2606:4700:7::21d]/alerts");
  });

  test("accepts global IPv4 and IPv6 while rejecting private or mixed DNS answers", async () => {
    const privateResolver = async () => [{ address: "127.0.0.1", family: 4 }] as any;
    const publicResolver = async () => [{ address: "162.159.142.41", family: 4 }, { address: "2606:4700:7::21d", family: 6 }] as any;
    const mixedResolver = async () => [{ address: "162.159.142.41", family: 4 }, { address: "fd00::1", family: 6 }] as any;
    await expect(assertPublicWebhookTarget("https://hooks.example.com/alerts", privateResolver)).rejects.toThrow("private network");
    await expect(assertPublicWebhookTarget("https://hooks.example.com/alerts", mixedResolver)).rejects.toThrow("private network");
    await expect(assertPublicWebhookTarget("https://hooks.example.com/alerts", publicResolver)).resolves.toBe("https://hooks.example.com/alerts");
  });
});
