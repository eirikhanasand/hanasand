export default function formatUtcDateTime(value?: string | null, fallback = 'Unknown') {
    if (!value) return fallback

    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return fallback

    const iso = date.toISOString()
    return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}, ${iso.slice(11, 16)} UTC`
}
