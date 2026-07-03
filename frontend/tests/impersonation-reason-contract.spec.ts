import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const repoRoot = path.resolve(root, '..')

test('management impersonation requires an admin-provided audit reason', async () => {
    const client = await readFile(path.join(root, 'src/utils/impersonation/client.ts'), 'utf8')
    const dashboardUser = await readFile(path.join(root, 'src/components/users/dashboardUser.tsx'), 'utf8')
    const nativeUsersPanel = await readFile(path.join(repoRoot, 'app/desktop/Sources/Hanasand/Screens/146-UsersNativePanel+Part01.swift'), 'utf8')
    const nativeModel = await readFile(path.join(repoRoot, 'app/desktop/Sources/Hanasand/Lib/011-DesktopAgentModel+Part32.swift'), 'utf8')

    expect(client).toContain('startImpersonating(id: string, reason: string)')
    expect(client).toContain('auditReason.length < 10')
    expect(client).toContain('reason: auditReason')
    expect(client).toContain('durationMinutes: 30')
    expect(client).toContain('scope: [\'read_profile\', \'read_org\']')

    expect(dashboardUser).toContain('setImpersonationPromptOpen(true)')
    expect(dashboardUser).toContain('aria-label={`Impersonation reason for ${user.id}`}')
    expect(dashboardUser).toContain('auditReason.length < 10')
    expect(dashboardUser).toContain('setImpersonationReasonError(error instanceof Error ? error.message')
    expect(dashboardUser).toContain('await startImpersonating(user.id, auditReason)')
    expect(dashboardUser).toContain('placeholder=\'Describe the support case or audit reason\'')

    expect(nativeUsersPanel).toContain('pendingImpersonationUser = user')
    expect(nativeUsersPanel).toContain('.sheet(item: $pendingImpersonationUser')
    expect(nativeUsersPanel).toContain('Enter at least 10 characters')
    expect(nativeUsersPanel).toContain('model.impersonateDashboardUser(user, reason: reason)')

    expect(nativeModel).toContain('let reason: String')
    expect(nativeModel).toContain('let durationMinutes: Int')
    expect(nativeModel).toContain('let scope: [String]')
    expect(nativeModel).toContain('impersonateDashboardUser(_ user: DashboardUser, reason: String)')
    expect(nativeModel).toContain('durationMinutes: 30')
    expect(nativeModel).toContain('scope: ["read_profile", "read_org"]')
})
