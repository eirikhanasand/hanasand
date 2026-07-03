import fetchTrafficJson from './fetchTrafficJson'

export default async function getBlocklist() {
    return fetchTrafficJson('/blocklist/overview', [])
}
