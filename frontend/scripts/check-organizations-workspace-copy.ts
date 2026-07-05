import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/organizations/organizationWorkspaceClient.tsx', import.meta.url), 'utf8')

function assert(condition: unknown, message: string) {
    if (!condition) throw new Error(message)
}

assert(source.includes('label: \'Alert flow\''), 'Organization health strip should frame setup as alert flow, not internal case scope.')
assert(source.includes('activeTerms.length ? \'Listening for matches\' : \'Add watch term\''), 'Organization health strip should guide empty alert state to watchlist setup.')
assert(!source.includes('`Tenant ${organization.tenantId}`'), 'Organization health strip must not render raw tenant ids as setup copy.')
assert(!source.includes('{organization.tenantId || \'default tenant\'}'), 'Organization summary must not render raw tenant ids or default-tenant copy.')
assert(source.includes('const workspaceMeta = sanitizeOrganizationDisplayCopy(organization.tenantId || organization.slug || organization.id) || \'Default workspace\''), 'Organization summary should sanitize workspace metadata before rendering.')
assert(source.includes('const showRecordActions = !route.startsWith(\'/api/\')'), 'Organization scope panels should hide endpoint copy/open controls for API-backed routes.')
assert(source.includes('Action unavailable'), 'Organization route misses should render as action availability copy.')
assert(!source.includes('Endpoint unavailable'), 'Organization UI should not expose endpoint-shaped error copy.')
assert(source.includes('const ORG_ACTIVITY_PREVIEW_ROWS = 8'), 'Organization activity rail should stay compact by default.')
assert(!/activity\.slice\(0,\s*20\)|selectedRows\.slice\(0,\s*20\)/.test(source), 'Organization activity rail should not render a long event wall by default.')
assert(source.includes('destinationConfigured(item) ? \'configured\' : \'route needed\''), 'Organization destination state should use operator action language.')
assert(source.includes('configured ? \'configured\' : \'route needed\''), 'Organization destination editor should use operator action language.')
assert(source.includes('History: {delivery ? formatDate(delivery.attemptedAt || delivery.updatedAt || delivery.createdAt) : \'waiting for test\'}'), 'Organization destination history should explain missing delivery history.')
assert(source.includes('delivery.nextRetryAt ? \'scheduled\' : \'no retry scheduled\''), 'Organization delivery rows should avoid dead none labels.')
assert(!source.includes('destinationConfigured(item) ? \'configured\' : \'none\''), 'Organization destination state should not render dead none labels.')
assert(!source.includes('configured ? \'configured\' : \'not configured\''), 'Organization destination editor should not render setup as not configured.')
assert(!source.includes('History: {delivery ? formatDate(delivery.attemptedAt || delivery.updatedAt || delivery.createdAt) : \'none\'}'), 'Organization destination history should not render dead none labels.')

console.log('[organizations-workspace-copy] org workspace copy guardrails passed')
