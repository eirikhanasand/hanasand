import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('vm detail routes use one canonical workflow with a recovery state', async () => {
    const systemAlias = await readFile(path.join(root, 'src/app/dashboard/system/[...id]/page.tsx'), 'utf8')
    const vmDetail = await readFile(path.join(root, 'src/app/dashboard/vms/[...id]/page.tsx'), 'utf8')

    expect(systemAlias).toContain('params.id.map(segment => encodeURIComponent(segment)).join')
    expect(systemAlias).toContain('redirect(`/dashboard/vms/${id}`)')
    expect(systemAlias).not.toContain('VMDetailClient')
    expect(systemAlias).not.toContain('getVM(')

    expect(vmDetail).toContain('VM detail unavailable')
    expect(vmDetail).toContain('Next safe action')
    expect(vmDetail).toContain('Back to VMs')
    expect(vmDetail).toContain('Open inventory')
    expect(vmDetail).toContain('Retry detail')
    expect(vmDetail).toContain('<VMClient')
    expect(vmDetail).not.toContain('return null')
    expect(vmDetail).not.toContain('What returned')
})
