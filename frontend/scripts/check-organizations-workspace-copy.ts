import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/organizations/organizationWorkspaceClient.tsx', import.meta.url), 'utf8')

function assert(condition: unknown, message: string) {
    if (!condition) throw new Error(message)
}

assert(source.includes('label: \'Alert flow\''), 'Organization health strip should frame setup as alert flow, not internal case scope.')
assert(source.includes('activeTerms.length ? \'Listening for matches\' : \'Add watch term\''), 'Organization health strip should guide empty alert state to watchlist setup.')
assert(!source.includes('`Tenant ${organization.tenantId}`'), 'Organization health strip must not render raw tenant ids as setup copy.')
assert(source.includes('const showRecordActions = !route.startsWith(\'/api/\')'), 'Organization scope panels should hide endpoint copy/open controls for API-backed routes.')
assert(source.includes('Action unavailable'), 'Organization route misses should render as action availability copy.')
assert(!source.includes('Endpoint unavailable'), 'Organization UI should not expose endpoint-shaped error copy.')

console.log('[organizations-workspace-copy] org workspace copy guardrails passed')
