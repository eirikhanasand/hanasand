import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import path from 'node:path'

const root = process.cwd()

test('organization workspace scopes alert workflow by selected tenant and role', async () => {
    const source = await readFile(path.join(root, 'src/app/organizations/organizationWorkspaceClient.tsx'), 'utf8')

    assert.match(source, /const \[selectedId, setSelectedId\] = useState\(''\)/)
    assert.match(source, /requestedOrganizationId \|\| selectedId/)
    assert.match(source, /onClick=\{\(\) => setSelectedId\(organization\.id\)\}/)
    assert.match(source, /selectedOrganization\?\.id === organization\.id/)

    assert.match(source, /selectedOrganization\?\.role === 'owner' \|\| selectedOrganization\?\.role === 'admin'/)
    assert.match(source, /disabled=\{!canManage \|\| !draft\.value\.trim\(\) \|\| draftDuplicate \|\| Boolean\(busy\)\}/)
    assert.match(source, /disabled=\{!canManage \|\| Boolean\(busy\)\}/)
    assert.match(source, /const canMutateMember = canManage && memberCanMutate\(member\)/)
    assert.match(source, /disabled=\{!canMutateMember \|\| Boolean\(busy\)\}/)
    assert.match(source, /return member\.role !== 'owner' && status !== 'removed' && status !== 'revoked' && status !== 'inactive'/)
    assert.match(source, /watchlistMutationMessage\(payload\.dwmAlertBridge/)
    assert.match(source, /generated/)
    assert.match(source, /No matching captures found/)

    for (const scopedRoute of [
        '/api/organizations/${encodeURIComponent(organizationId)}/settings',
        '/api/organizations/${encodeURIComponent(organizationId)}/members',
        '/api/organizations/${encodeURIComponent(organizationId)}/invites',
        '/api/organizations/${encodeURIComponent(organizationId)}/watchlists',
        '/api/organizations/${encodeURIComponent(organizationId)}/watchlists/alert-terms',
        '/api/organizations/${encodeURIComponent(organizationId)}/alert-case-visibility',
        '/api/dwm/alerts?organizationId=${encodeURIComponent(organizationId)}',
        '/api/cases?organizationId=${encodeURIComponent(organizationId)}',
        '/api/organizations/${encodeURIComponent(organizationId)}/webhooks',
        '/api/dwm/webhooks/deliveries?organizationId=${encodeURIComponent(organizationId)}',
    ]) {
        assert.ok(source.includes(scopedRoute), `Expected organization workspace to load ${scopedRoute}`)
    }
})
