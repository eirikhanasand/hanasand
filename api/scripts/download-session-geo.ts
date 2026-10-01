import { mkdir, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { Reader } from 'maxmind'

// DB-IP Lite, CC BY 4.0: https://db-ip.com/db/lite.php
// The session panel supplies the required attribution. Data stays on our servers.
const pinnedMonth = process.env.SESSION_GEOIP_MONTH
const requestedMonth = pinnedMonth || new Date().toISOString().slice(0, 7)
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) throw new Error('Invalid database month')

const monthAtOffset = (month, offset) => {
    const [year, number] = month.split('-').map(Number)
    return new Date(Date.UTC(year, number - 1 - offset, 1)).toISOString().slice(0, 7)
}
const kinds = ['city', 'asn']
const fallbackLimit = pinnedMonth ? 0 : 2
let selectedMonth
let databases

for (let offset = 0; offset <= fallbackLimit; offset++) {
    const month = monthAtOffset(requestedMonth, offset)
    const responses = await Promise.all(kinds.map(kind => fetch(
        `https://download.db-ip.com/free/dbip-${kind}-lite-${month}.mmdb.gz`,
        { signal: AbortSignal.timeout(120_000) },
    )))
    const failed = responses.find(response => !response.ok && response.status !== 404)
    if (failed) throw new Error(`DB-IP download failed: ${failed.status}`)
    if (responses.some(response => response.status === 404)) {
        if (offset === fallbackLimit) {
            const missingKinds = responses.flatMap((response, index) => response.status === 404 ? [kinds[index]] : [])
            throw new Error(`DB-IP ${missingKinds.join(' and ')} archive(s) unavailable for ${month}`)
        }
        console.log(`DB-IP Lite ${month} is not published yet; trying the preceding month`)
        continue
    }

    databases = await Promise.all(responses.map(async (response, index) => {
        const kind = kinds[index]
        const buffer = gunzipSync(Buffer.from(await response.arrayBuffer()), { maxOutputLength: 256 * 1024 * 1024 })
        const reader = new Reader(buffer)
        if (!reader.get('8.8.8.8')) throw new Error(`Invalid ${kind} database`)
        return { kind, buffer }
    }))
    selectedMonth = month
    break
}

if (!databases || !selectedMonth) throw new Error('No DB-IP Lite data was downloaded')
await mkdir('geoip', { recursive: true })
for (const { kind, buffer } of databases) {
    await writeFile(`geoip/${kind}.mmdb`, buffer)
    console.log(`Installed DB-IP ${kind} Lite ${selectedMonth}`)
}
