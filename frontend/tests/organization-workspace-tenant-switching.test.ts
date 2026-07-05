import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import path from 'node:path'

const root = process.cwd()

test('organization workspace scopes alert workflow by selected tenant and role', async () => {
    const source = await readFile(path.join(root, 'src/app/organizations/organizationWorkspaceClient.tsx'), 'utf8')
    const deliveriesRoute = await readFile(path.join(root, 'src/app/api/dwm/webhooks/deliveries/route.ts'), 'utf8')

    assert.match(source, /const \[selectedId, setSelectedId\] = useState\(''\)/)
    assert.match(source, /requestedOrganizationId \|\| selectedId/)
    assert.match(source, /onClick=\{\(\) => selectOrganization\(organization\.id\)\}/)
    assert.match(source, /selectedOrganization\?\.id === organization\.id/)
    assert.match(source, /replaceOrganizationWorkspaceSelectionUrl\(organizationId, subject\)/)
    assert.match(source, /replaceOrganizationWorkspaceSelectionUrl\(selectedOrganization\?\.id \|\| selectedId, subject\)/)
    assert.match(source, /url\.searchParams\.set\('organizationId', organizationId\)/)
    assert.match(source, /url\.searchParams\.set\('watchlistId', subject\.id\)/)
    assert.match(source, /url\.searchParams\.set\('destinationId', subject\.id\)/)
    assert.match(source, /url\.searchParams\.set\('inviteId', subject\.id\)/)
    assert.match(source, /url\.searchParams\.set\('memberId', subject\.id\)/)
    assert.match(source, /window\.history\.replaceState\(window\.history\.state, '', `\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`\)/)

    assert.match(source, /selectedOrganization\?\.role === 'owner' \|\| selectedOrganization\?\.role === 'admin'/)
    assert.match(source, /disabled=\{!canManage \|\| !draft\.value\.trim\(\) \|\| draftDuplicate \|\| Boolean\(busy\)\}/)
    assert.match(source, /disabled=\{!canManage \|\| Boolean\(busy\)\}/)
    assert.match(source, /const canMutateMember = canManage && memberCanMutate\(member\)/)
    assert.match(source, /disabled=\{!canMutateMember \|\| Boolean\(busy\)\}/)
    assert.match(source, /return member\.role !== 'owner' && status !== 'removed' && status !== 'revoked' && status !== 'inactive'/)
    assert.match(source, /members=\{bundle\.members\}/)
    assert.match(source, /function inviteEmailConflicts\(emails: string\[\], invites: OrganizationInvite\[\], members: OrganizationMember\[\]\)/)
    assert.match(source, /email\?: string/)
    assert.match(source, /member\.email\?\.toLowerCase\(\)/)
    assert.match(source, /member\.name \|\| member\.email \|\| member\.userId/)
    assert.match(source, /!\['revoked', 'expired'\]\.includes\(invite\.status\.toLowerCase\(\)\)/)
    assert.match(source, /!\['removed', 'revoked', 'inactive'\]\.includes\(member\.status\.toLowerCase\(\)\)/)
    assert.match(source, /disabled=\{!canSendInvite\}/)
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

    assert.match(deliveriesRoute, /if \(organizationId\) \{[\s\S]*proxyOrganizationApiRequest\(request, '\/dwm\/webhook-deliveries'/)
    assert.match(deliveriesRoute, /proxyTiRequest\(request, '\/v1\/dwm\/webhooks\/deliveries'/)
})
