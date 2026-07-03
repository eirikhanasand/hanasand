import fetchTrafficJson from './fetchTrafficJson'

export default async function getUAs() {
    return fetchTrafficJson('/traffic/uas', [])
}
