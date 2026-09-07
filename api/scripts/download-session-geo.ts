import { mkdir, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { Reader } from 'maxmind'

// DB-IP Lite, CC BY 4.0: https://db-ip.com/db/lite.php
// The session panel supplies the required attribution. Data stays on our servers.
const month = process.env.SESSION_GEOIP_MONTH || new Date().toISOString().slice(0, 7)
if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid database month')
await mkdir('geoip', { recursive: true })
for (const kind of ['city', 'asn']) {
    const response = await fetch(`https://download.db-ip.com/free/dbip-${kind}-lite-${month}.mmdb.gz`, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(`DB-IP ${kind} download failed: ${response.status}`)
    const buffer = gunzipSync(Buffer.from(await response.arrayBuffer()), { maxOutputLength: 256 * 1024 * 1024 })
    const reader = new Reader(buffer)
    if (!reader.get('8.8.8.8')) throw new Error(`Invalid ${kind} database`)
    await writeFile(`geoip/${kind}.mmdb`, buffer)
    console.log(`Installed DB-IP ${kind} Lite ${month}`)
}
