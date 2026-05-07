import { readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(import.meta.dir, '../..')

function read(path: string) {
    return readFileSync(resolve(root, path), 'utf8')
}

function assertIncludes(path: string, needle: string, description: string) {
    const content = read(path)
    if (!content.includes(needle)) {
        throw new Error(`${description} missing in ${path}: ${needle}`)
    }
}

function assertNotIncludes(path: string, needle: string, description: string) {
    const content = read(path)
    if (content.includes(needle)) {
        throw new Error(`${description} should not be present in ${path}: ${needle}`)
    }
}

function assertMatches(path: string, pattern: RegExp, description: string) {
    const content = read(path)
    if (!pattern.test(content)) {
        throw new Error(`${description} missing in ${path}: ${pattern}`)
    }
}

const checks: Array<() => void> = [
    () => assertIncludes('api/src/utils/db/ensureSchema.ts', 'CREATE TABLE IF NOT EXISTS impersonation_sessions', 'server-issued session table'),
    () => assertIncludes('api/src/utils/db/ensureSchema.ts', 'session_id UUID REFERENCES impersonation_sessions', 'audit/session foreign key'),
    () => assertIncludes('api/src/routes.ts', 'fastify.post(\'/impersonation/start\'', 'start impersonation route'),
    () => assertIncludes('api/src/routes.ts', 'fastify.delete(\'/impersonation\'', 'stop impersonation route'),
    () => assertIncludes('api/src/routes.ts', 'fastify.get(\'/impersonation/events\'', 'audit route'),
    () => assertIncludes('api/src/utils/auth/tokenWrapper.ts', 'req.headers[\'x-impersonation-token\']', 'opaque impersonation token header'),
    () => assertNotIncludes('api/src/utils/auth/tokenWrapper.ts', 'x-impersonate-id', 'legacy target header authority'),
    () => assertIncludes('api/src/utils/auth/tokenWrapper.ts', 'Return to own view before changing account, security, or system settings.', 'sensitive action guardrail'),
    () => assertIncludes('api/src/handlers/impersonation.ts', 'crypto.randomUUID()', 'server-generated impersonation token'),
    () => assertMatches('api/src/handlers/impersonation.ts', /INSERT INTO impersonation_sessions[\s\S]+token_hash/, 'hashed token persistence'),
    () => assertIncludes('frontend/src/utils/impersonation/client.ts', '/impersonation/start', 'web start preflight'),
    () => assertIncludes('frontend/src/utils/impersonation/client.ts', 'impersonation_token', 'web opaque token storage'),
    () => assertIncludes('frontend/src/app/dashboard/system/impersonation/page.tsx', '/impersonation/events', 'web audit page fetch'),
    () => assertIncludes('app/src/types.ts', 'impersonationToken: string', 'mobile settings token'),
    () => assertIncludes('app/src/lib/api.ts', 'startMobileImpersonation', 'mobile start preflight'),
    () => assertIncludes('app/src/lib/api.ts', '\'x-impersonation-token\'', 'mobile opaque token header'),
    () => assertIncludes('app/desktop/Sources/Hanasand/Models/006-HanasandDesktopSettings.swift', 'var impersonationToken = ""', 'desktop settings token'),
    () => assertIncludes('app/desktop/Sources/Hanasand/Lib/011-DesktopAgentModel+Part32.swift', 'impersonation/start', 'desktop start preflight'),
    () => assertIncludes('app/desktop/Sources/Hanasand/Lib/011-DesktopAgentModel+Part27.swift', '"x-impersonation-token"', 'desktop opaque token header'),
]

for (const check of checks) check()

console.log(`impersonation production contract ok (${checks.length} checks)`)
