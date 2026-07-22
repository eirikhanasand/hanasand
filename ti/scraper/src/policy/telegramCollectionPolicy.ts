import type { SourceRecord } from "../types.ts";

export function evaluateTelegramPublicCompliance(source: SourceRecord): { allowed: true } | { allowed: false; reason: string } {
  const target = source.url.trim();
  if (/\bt\.me\/(?:joinchat|\+|c\/)|\btelegram\.me\/(?:joinchat|\+|c\/)|^tg:\/\/join/i.test(target)) {
    return { allowed: false, reason: "public Telegram source uses prohibited invite, joinchat, or private-channel URL" };
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return { allowed: false, reason: "public Telegram source URL is invalid" };
  }
  if (url.protocol !== "https:" || url.username || url.password || !["t.me", "telegram.me"].includes(url.hostname.toLowerCase())) {
    return { allowed: false, reason: "public Telegram source must use an unauthenticated HTTPS t.me or telegram.me URL" };
  }
  if (!/^\/(?:s\/)?[a-z0-9_]{4,}\/?$/i.test(url.pathname)) {
    return { allowed: false, reason: "public Telegram source must identify one public channel without message, invite, or private paths" };
  }

  const metadata = source.metadata ?? {};
  for (const key of [
    "accountAutomation", "autoJoin", "joinGroups", "joinChannels", "privateChannel", "inviteLink",
    "sessionString", "userSession", "phoneNumber", "password", "bypassAccessControls",
    "requiresAuthentication", "authenticationRequired", "authRequired", "credentialRequired",
    "loginRequired", "captchaRequired"
  ]) {
    const value = metadata[key];
    if (value === undefined || value === false || value === "") continue;
    return { allowed: false, reason: `public Telegram source config implies prohibited account automation or private access: ${key}` };
  }

  return { allowed: true };
}
