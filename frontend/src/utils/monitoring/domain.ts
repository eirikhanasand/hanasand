export function normalizeDomainName(value: string | null | undefined) {
    if (!value) {
        return null
    }

    const trimmed = value.trim().toLowerCase()
    if (!trimmed) {
        return null
    }

    const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, '')
    const host = withoutProtocol.split('/')[0]?.trim() || ''
    if (!host || host.startsWith('/')) {
        return null
    }

    if (host === 'localhost') {
        return host
    }

    return host.includes('.') ? host : null
}

export function toDomainTPS(
    seedDomains: string[] = [],
    liveDomains: Array<{ name: string, tps: number }> = [],
    limit = 5
) {
    const live = liveDomains
        .map((entry) => {
            const name = normalizeDomainName(entry.name)
            return name ? { name, tps: entry.tps } : null
        })
        .filter((entry): entry is { name: string, tps: number } => Boolean(entry))

    if (live.length) {
        return [...new Map(live.map((entry) => [entry.name, entry])).values()]
            .sort((a, b) => b.tps - a.tps)
            .slice(0, limit)
    }

    return seedDomains
        .map((entry) => normalizeDomainName(entry))
        .filter((entry): entry is string => Boolean(entry))
        .slice(0, limit)
        .map((name) => ({ name, tps: 0 }))
}
