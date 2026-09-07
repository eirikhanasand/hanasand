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

// Page numbers are one-based. Storage queries continue to accept offsets or legacy keyset cursors.
export function paginationCursor(params: URLSearchParams, limit: number): string | undefined {
  if (!params.has("page")) return params.get("cursor") ?? undefined
  const raw = params.get("page")!
  const page = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * limit)) {
    throw new RangeError("Page must be a positive whole number.")
  }
  if (params.get("cursor")) throw new RangeError("Use page without cursor.")
  return String((page - 1) * limit)
}
