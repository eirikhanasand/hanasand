import fetchTrafficJson from './fetchTrafficJson'

export default async function fetchLogs(sortBy: 'hits' | 'last_seen' = 'last_seen') {
    return fetchTrafficJson(`/traffic/recent?sort=${sortBy}`, [])
}
