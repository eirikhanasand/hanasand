import fetchTrafficJson from './fetchTrafficJson'

export default async function getDomains() {
    const data = await fetchTrafficJson<unknown[]>('/traffic/tps?fresh=1', [])

    return data
        .map((entry) => {
            const name = typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string' ? entry.name : ''
            const tps = typeof entry === 'object' && entry !== null && 'tps' in entry ? Number(entry.tps) : 0
            return { name, tps: Number.isFinite(tps) ? tps : 0 }
        })
        .filter((entry) => {
            const name = entry.name
            if (!name) return false
            if (name.startsWith('/')) return false
            if (name.includes(' ')) return false
            return name.includes('.') || name === 'localhost'
        })
}
