export type KeysetCursor = { at: string, id: string }

export function encodeKeysetCursor(at: string | null | undefined, id: string | null | undefined): string | undefined {
  if (!at || !id) return undefined
  return Buffer.from(JSON.stringify({ at, id }), "utf8").toString("base64url")
}

export function decodeKeysetCursor(value: string | null | undefined): KeysetCursor | undefined {
  if (!value || /^\d+$/.test(value)) return undefined
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<KeysetCursor>
    return typeof parsed.at === "string" && typeof parsed.id === "string" ? { at: parsed.at, id: parsed.id } : undefined
  } catch {
    return undefined
  }
}

export function legacyOffset(value: string | null | undefined): number {
  return Math.max(0, Number(value ?? 0) || 0)
}
