import { request } from 'node:http'

export function usesBackupWorker() {
    return Boolean(process.env.DB_BACKUP_WORKER_SOCKET) && process.env.DB_BACKUP_WORKER !== '1'
}

// The socket lives in the private backup directory. Existing HTTP authorization
// remains in the API; no backup control port is exposed on the network.
export async function backupWorkerCall<T>(method: string, args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = request({ socketPath: process.env.DB_BACKUP_WORKER_SOCKET,
            path: '/', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', chunk => { body += chunk })
            res.on('error', reject)
            res.on('end', () => {
                try {
                    const result = JSON.parse(body)
                    if (res.statusCode !== 200) {
                        reject(Object.assign(new Error(result.error || 'Backup worker request failed.'), { statusCode: res.statusCode }))
                    } else resolve(result.value as T)
                } catch (error) { reject(error) }
            })
        })
        req.on('error', () => reject(Object.assign(new Error('The backup worker is unavailable.'), { statusCode: 503 })))
        req.end(JSON.stringify({ method, args }))
    })
}
