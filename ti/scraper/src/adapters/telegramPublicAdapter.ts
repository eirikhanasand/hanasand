import type { CollectionAdapter } from "./base.ts";
import type { CollectionTask, SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import { itemFromMessage, parseTelegramTarget, validateTelegramPublicSourceCompliance } from "./telegramPublicHelpers.ts";

export class TelegramPublicAdapterError extends Error {
  constructor(readonly category: string, message: string) { super(message); this.name = "TelegramPublicAdapterError"; }
}

export class TelegramPublicAdapter implements CollectionAdapter {
  readonly type = "telegram_public" as const;
  constructor(private readonly client: any = {}) {}
  async collect(source: SourceRecord, task?: CollectionTask) {
    const compliance = validateTelegramPublicSourceCompliance(source);
    if (!compliance.allowed) return { items: [], discovered: [], warnings: [compliance.reason] };
    const config = parseTelegramPublicSourceConfig(source, task);
    const fetched = await this.client.fetchPublicChannelMessages?.({ channel: config.channel, limit: config.limit }) ?? { messages: [] };
    const collectedAt = nowIso();
    return { items: (fetched.messages ?? []).map((message: any) => itemFromMessage(source, message, collectedAt, task)), discovered: [], warnings: [] };
  }
}

export class TelegramBotApiClient {
  constructor(readonly options: any = {}) {}
  async fetchPublicChannelMessages(request: any) { return { channel: request.channel, messages: [], nextCursor: request.cursor }; }
}

export function parseTelegramPublicSourceConfig(source: SourceRecord, task?: CollectionTask) {
  const channel = parseTelegramTarget(task?.targetUrl ?? source.url).channel;
  if (!channel) throw new TelegramPublicAdapterError("parse_error", "Public channel handle required");
  return { channel, limit: Number(source.metadata?.limit ?? 20), pagination: source.crawlState };
}
