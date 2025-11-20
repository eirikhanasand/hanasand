export default function parseCookie<T>(input: string | undefined, fallback: T): T {
    try {
        const val = JSON.parse(input || '')
        return typeof val === typeof fallback ? val : fallback
    } catch {
        return fallback
    }
}
