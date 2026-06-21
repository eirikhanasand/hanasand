import type { SourceRecord } from "../types.ts";

export function evaluateTelegramPublicCompliance(source: SourceRecord): { allowed: true } | { allowed: false; reason: string } {
  const target = source.url.trim().toLowerCase();
  if (/\bt\.me\/(?:joinchat|\+|c\/)|\btelegram\.me\/(?:joinchat|\+|c\/)|^tg:\/\/join/i.test(target)) {
    return { allowed: false, reason: "public Telegram source uses prohibited invite, joinchat, or private-channel URL" };
  }

  const metadata = source.metadata ?? {};
  for (const key of [
    "accountAutomation", "autoJoin", "joinGroups", "joinChannels", "privateChannel", "inviteLink",
    "sessionString", "userSession", "phoneNumber", "password", "bypassAccessControls"
  ]) {
    const value = metadata[key];
    if (value === undefined || value === false || value === "") continue;
    return { allowed: false, reason: `public Telegram source config implies prohibited account automation or private access: ${key}` };
  }

  return { allowed: true };
}
