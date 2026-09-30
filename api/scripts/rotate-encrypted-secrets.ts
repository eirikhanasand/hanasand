import pg from 'pg'
import { decryptSecret, deriveSecretKey, encryptSecret } from '../src/utils/crypto/secretBox.ts'
import { decryptRepoSecret, encryptRepoSecret, isRepoSecretEncryptedWithCurrentKey } from '../src/utils/ai/repoCredentials.ts'

if (process.env.ROTATE_ENCRYPTED_SECRETS_CONFIRM !== '1') {
    throw new Error('Set ROTATE_ENCRYPTED_SECRETS_CONFIRM=1 to run the encrypted-secret migration.')
}

const mailCurrent = process.env.MAIL_SERVICE_KEY?.trim()
const dwmCurrent = process.env.DWM_WEBHOOK_SECRET_KEY?.trim()
if (!mailCurrent || !dwmCurrent || !process.env.AI_REPO_SECRET_KEY?.trim()) {
    throw new Error('Dedicated mail, DWM, and AI repository encryption keys are required.')
}

const previousSources = [
    process.env.AI_REPO_SECRET_KEY_PREVIOUS,
    process.env.MAIL_SERVICE_KEY_PREVIOUS,
    process.env.DWM_WEBHOOK_SECRET_KEY_PREVIOUS,
    process.env.VM_API_TOKEN_PREVIOUS,
    process.env.DB_PASSWORD_PREVIOUS,
].filter((value): value is string => Boolean(value?.trim()))
const previousKeys = [...new Set(previousSources)].map(deriveSecretKey)
const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB || 'hanasand',
    user: process.env.DB_USER || 'hanasand',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10_000,
})

async function rotateRows(input: {
    table: 'mail_accounts' | 'shared_mail_accounts' | 'dwm_webhook_destinations'
    idColumn: 'user_id' | 'id'
    secretColumn: 'mail_password_encrypted' | 'endpoint_encrypted'
    currentKey: Buffer
}) {
    const { table, idColumn, secretColumn, currentKey } = input
    const { rows } = await client.query(
        `SELECT ${idColumn} AS id, ${secretColumn} AS secret FROM ${table} WHERE ${secretColumn} IS NOT NULL FOR UPDATE`,
    )
    let changed = 0
    for (const row of rows as Array<{ id: string, secret: string }>) {
        try {
            decryptSecret(row.secret, [currentKey])
            continue
        } catch {
            // Existing records can still be read with one of the rollout keys.
        }
        if (!previousKeys.length) throw new Error(`No previous key is configured for ${table}.`)
        const plaintext = decryptSecret(row.secret, previousKeys)
        const rotated = encryptSecret(plaintext, currentKey)
        const result = await client.query(
            `UPDATE ${table} SET ${secretColumn} = $2 WHERE ${idColumn} = $1 AND ${secretColumn} = $3`,
            [row.id, rotated, row.secret],
        )
        if (result.rowCount !== 1) throw new Error(`Concurrent update blocked migration of ${table}.`)
        changed++
    }
    return { scanned: rows.length, changed }
}

async function rotateAiRepoCredentials() {
    const { rows } = await client.query(
        'SELECT id, github_token_encrypted AS secret FROM ai_imported_repositories WHERE github_token_encrypted IS NOT NULL FOR UPDATE',
    )
    let changed = 0
    for (const row of rows as Array<{ id: string, secret: string }>) {
        if (isRepoSecretEncryptedWithCurrentKey(row.secret)) continue

        const rotated = encryptRepoSecret(decryptRepoSecret(row.secret))
        const result = await client.query(
            'UPDATE ai_imported_repositories SET github_token_encrypted = $2 WHERE id = $1 AND github_token_encrypted = $3',
            [row.id, rotated, row.secret],
        )
        if (result.rowCount !== 1) throw new Error('Concurrent update blocked migration of AI repository credentials.')
        changed++
    }
    return { scanned: rows.length, changed }
}

async function rotateCaseRepositorySecrets() {
    const { rows } = await client.query(
        'SELECT id, secret_encrypted AS secret FROM case_repositories WHERE secret_encrypted IS NOT NULL FOR UPDATE',
    )
    let changed = 0
    for (const row of rows as Array<{ id: string, secret: string }>) {
        if (isRepoSecretEncryptedWithCurrentKey(row.secret)) continue

        const rotated = encryptRepoSecret(decryptRepoSecret(row.secret))
        const result = await client.query(
            'UPDATE case_repositories SET secret_encrypted = $2 WHERE id = $1 AND secret_encrypted = $3',
            [row.id, rotated, row.secret],
        )
        if (result.rowCount !== 1) throw new Error('Concurrent update blocked migration of case repository secrets.')
        changed++
    }
    return { scanned: rows.length, changed }
}

await client.connect()
try {
    await client.query('BEGIN')
    const result = {
        mailAccounts: await rotateRows({ table: 'mail_accounts', idColumn: 'user_id', secretColumn: 'mail_password_encrypted', currentKey: deriveSecretKey(mailCurrent) }),
        sharedMailAccounts: await rotateRows({ table: 'shared_mail_accounts', idColumn: 'id', secretColumn: 'mail_password_encrypted', currentKey: deriveSecretKey(mailCurrent) }),
        dwmDestinations: await rotateRows({ table: 'dwm_webhook_destinations', idColumn: 'id', secretColumn: 'endpoint_encrypted', currentKey: deriveSecretKey(dwmCurrent) }),
        aiRepoCredentials: await rotateAiRepoCredentials(),
        caseRepositorySecrets: await rotateCaseRepositorySecrets(),
    }
    await client.query('COMMIT')
    console.info('Encrypted credential migration completed.', result)
} catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
} finally {
    await client.end()
}
