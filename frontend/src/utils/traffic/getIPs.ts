import fetchTrafficJson from './fetchTrafficJson'

export default async function getIPs() {
    return fetchTrafficJson('/traffic/ips', [])
}
