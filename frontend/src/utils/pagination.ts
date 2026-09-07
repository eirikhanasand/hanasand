export function pageNumber(value: string | string[] | undefined): number {
    const raw = Array.isArray(value) ? value[0] : value
    const page = Number(raw)
    return raw && /^\d+$/.test(raw) && Number.isSafeInteger(page) && page >= 1 && page <= Math.floor(Number.MAX_SAFE_INTEGER / 500) ? page : 1
}
