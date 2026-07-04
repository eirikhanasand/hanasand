import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('organization workspace keeps launch workflow primary and admin controls disclosed', async () => {
    const page = await readFile(path.join(root, 'src/app/organizations/organizationWorkspaceClient.tsx'), 'utf8')

    expect(page).toContain('data-org-setup-progress')
    expect(page).toContain('data-org-watchlist-starter')
    expect(page).toContain('Notification setup')
    expect(page).toContain('Shared watchlists')
    expect(page).toContain('Test destination')
    expect(page).toContain('/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists')
    expect(page).toContain('/api/dwm/webhooks/deliver')

    expect(page).toContain('data-org-settings-disclosure')
    expect(page).toContain('Advanced organization settings')
    expect(page).toContain('data-org-members-disclosure')
    expect(page).toContain('data-org-destinations-disclosure')
    expect(page).toContain('Saved destinations')

    expect(page.indexOf('<WatchlistPanel')).toBeLessThan(page.indexOf('<SettingsPanel'))
    expect(page.indexOf('data-org-settings-disclosure')).toBeLessThan(page.indexOf('Save settings'))
    expect(page.indexOf('data-org-members-disclosure')).toBeLessThan(page.indexOf('Remove member'))
    expect(page.indexOf('data-org-destinations-disclosure')).toBeLessThan(page.indexOf('Remove destination'))

    expect(page).toContain('onRoleChange={(member, role) => void changeMemberRole(member, role)}')
    expect(page).toContain('onTest={destination => void testSavedDestination(destination)}')
    expect(page).toContain('onDelete={destination => void deleteSavedDestination(destination)}')
})
