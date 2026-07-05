import assert from 'node:assert/strict'
import { buildTokenHint, decryptRepoSecret, encryptRepoSecret } from '../src/utils/ai/repoCredentials.ts'

const secretEnvNames = ['AI_REPO_SECRET_KEY', 'MAIL_SERVICE_KEY', 'VM_API_TOKEN', 'DB_PASSWORD'] as const
const previousEnv = new Map<string, string | undefined>()

for (const name of secretEnvNames) {
    previousEnv.set(name, process.env[name])
    delete process.env[name]
}

try {
    assert.throws(
        () => encryptRepoSecret('ghp_unit_token_secret'),
        /AI_REPO_SECRET_KEY or another server-side secret source is required/,
        'Repository credentials must not use a public fallback encryption key.'
    )

    process.env.AI_REPO_SECRET_KEY = 'unit-test-repo-secret-key'

    const token = 'ghp_unit_token_secret'
    const encrypted = encryptRepoSecret(token)

    assert.notEqual(encrypted, token, 'Encrypted repository credentials should not equal plaintext.')
    assert(!encrypted.includes(token), 'Encrypted repository credentials should not contain plaintext.')
    assert.equal(decryptRepoSecret(encrypted), token, 'Configured repository credential key should round-trip.')
    assert.equal(buildTokenHint(token), '••••cret', 'Token hints should reveal only the trailing characters.')

    delete process.env.AI_REPO_SECRET_KEY
    process.env.DB_PASSWORD = 'unit-test-db-secret-key'

    const dbEncrypted = encryptRepoSecret(token)
    assert.equal(decryptRepoSecret(dbEncrypted), token, 'Existing server-side DB secret fallback should round-trip.')
} finally {
    for (const [name, value] of previousEnv) {
        if (value === undefined) {
            delete process.env[name]
        } else {
            process.env[name] = value
        }
    }
}
