const MIB = 1024 * 1024
const MIN_UPLOAD_TIMEOUT_MS = 120_000
const UPLOAD_TIMEOUT_PER_MIB_MS = 10_000
const MAX_UPLOAD_TIMEOUT_MS = 10 * 60_000

export function uploadTimeoutForFileSize(fileSizeBytes: number, fallbackTimeoutMs: number) {
    const safeFallback = Number.isFinite(fallbackTimeoutMs) && fallbackTimeoutMs > 0 ? fallbackTimeoutMs : 30_000
    const safeFileSize = Number.isFinite(fileSizeBytes) && fileSizeBytes > 0 ? fileSizeBytes : 0
    const sizeTimeout = MIN_UPLOAD_TIMEOUT_MS + Math.ceil(safeFileSize / MIB) * UPLOAD_TIMEOUT_PER_MIB_MS

    return Math.min(Math.max(safeFallback, sizeTimeout), MAX_UPLOAD_TIMEOUT_MS)
}
