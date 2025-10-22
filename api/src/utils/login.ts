import run from '#db'
import { randomUUID } from 'crypto'

export default async function login({ id, ip }: { id: string, ip: string }): Promise<string | false> {
    const nonce1 = randomUUID().replaceAll('-', '')
    const nonce2 = randomUUID().replaceAll('-', '')
    const token = nonce1 + nonce2

    const loginResult = await run('INSERT INTO tokens (id, token, ip) VALUES ($1, $2, $3);', [id, token, ip])
    if (!loginResult.rowCount) {
        return false
    }

    return token
}
