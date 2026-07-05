import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('dashboard sidebar keeps internal products admin-only without deleting them', () => {
    const sidebar = readFileSync(path.join(root, 'src/components/dashboard/dashboardSidebar.tsx'), 'utf8')
    const strictPaths = readFileSync(path.join(root, 'src/utils/proxy/pathToRoleArray.ts'), 'utf8')
    const productBlock = sourceBetween(sidebar, 'const productItems: Item[] = [', 'const workspaceItems: Item[] = [')
    const workspaceBlock = sourceBetween(sidebar, 'const workspaceItems: Item[] = [', 'const systemItems: Item[] = []')
    const customerBlocks = `${productBlock}\n${workspaceBlock}`

    const customerAllowed = ['Console', 'Threat search', 'Dark web', 'API docs', 'Subscription', 'Profile']
    for (const label of customerAllowed) {
        assert(sidebar.includes(`label: '${label}'`), `${label} should remain available in the customer console navigation.`)
    }

    const adminOnly = [
        ['VMs', '/dashboard/vms'],
        ['Projects', '/dashboard/projects'],
        ['Shares', '/dashboard/shares'],
        ['Mail', '/dashboard/mail'],
        ['Automations', '/dashboard/automations'],
        ['Notes', '/dashboard/notes'],
        ['Traffic', '/dashboard/traffic'],
        ['System', '/dashboard/system'],
        ['AI Metrics', '/dashboard/system/ai'],
        ['Vulnerabilities', '/dashboard/vulnerabilities'],
        ['Articles', '/dashboard/articles'],
        ['Thoughts', '/dashboard/thoughts'],
        ['Logs', '/dashboard/logs'],
        ['Database', '/dashboard/db'],
        ['Backup', '/dashboard/db/backups'],
        ['Rate Limits', '/dashboard/system/rate-limits'],
        ['Cron Jobs', '/dashboard/cron-jobs'],
        ['Impersonation', '/dashboard/system/impersonation'],
        ['Management', '/dashboard/management'],
    ] as const

    for (const [label, href] of adminOnly) {
        assert(sidebar.includes(`label: '${label}'`), `${label} should stay in the product for admins.`)
        assert(sidebar.includes(`href: '${href}'`), `${href} should stay linked from the admin/sidebar navigation.`)
        assert(!customerBlocks.includes(`label: '${label}'`), `${label} should not be in the always-visible customer sidebar blocks.`)
        assert(strictPaths.includes(`path: '${href}'`) || strictPaths.includes(`path: '${href.split('/').slice(0, -1).join('/')}'`), `${href} should be covered by strict role routing.`)
    }

    assert(sidebar.includes("if (isAdmin)"), 'Admin controls should stay behind the existing admin gate.')
    assert(sidebar.includes("if (canManageSystem)"), 'System controls should stay behind the existing system-admin gate.')
    assert(sidebar.includes("if (canManageContent)"), 'Content controls should stay behind the existing content-admin gate.')
})

function sourceBetween(source: string, start: string, end: string) {
    const startIndex = source.indexOf(start)
    const endIndex = source.indexOf(end)
    assert(startIndex >= 0, `Missing start marker: ${start}`)
    assert(endIndex > startIndex, `Missing end marker after ${start}: ${end}`)
    return source.slice(startIndex, endIndex)
}
