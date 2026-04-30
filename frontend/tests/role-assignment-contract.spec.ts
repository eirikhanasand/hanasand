import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('role assignment helpers send target user in URL and role_id in body', async () => {
    const assignHelper = await readFile(path.join(root, 'src/utils/roles/assignRole.ts'), 'utf8')
    const unassignHelper = await readFile(path.join(root, 'src/utils/roles/unassignRole.ts'), 'utf8')
    const userRoleHandler = await readFile(path.join(root, 'src/components/roles/userRoleHandler.tsx'), 'utf8')

    for (const helper of [assignHelper, unassignHelper]) {
        expect(helper).toContain('target: string')
        expect(helper).toContain('/role/')
        expect(helper).toContain('${target}')
        expect(helper).toContain('body: JSON.stringify({ role_id: role })')
    }

    expect(userRoleHandler).toContain('target: user.id')
    expect(userRoleHandler).toContain('aria-label={`${active ? \'Remove\' : \'Assign\'} ${role.id} for ${user.id}`}')
})
