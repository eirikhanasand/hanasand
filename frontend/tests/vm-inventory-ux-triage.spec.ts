import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('vm inventory exposes explicit safe and destructive actions', async () => {
    const vmRow = await readFile(path.join(root, 'src/components/profile/vm.tsx'), 'utf8')

    expect(vmRow).toContain('data-vm-primary-action')
    expect(vmRow).toContain('Open details')
    expect(vmRow).toContain('router.push(`/dashboard/vm/${vm.name}`)')
    expect(vmRow).toContain('<RestartButtons vm={vm} />')

    expect(vmRow).toContain('data-vm-danger-actions')
    expect(vmRow).toContain('Danger actions')
    expect(vmRow).toContain('Delete VM')
    expect(vmRow).toContain('deleteVM(vm.name)')
    expect(vmRow.indexOf('data-vm-danger-actions')).toBeLessThan(vmRow.indexOf('Delete VM'))

    expect(vmRow).not.toContain('useKeyPress')
    expect(vmRow).not.toContain('keys[\'shift\']')
    expect(vmRow).not.toContain('select-none hover:border-ui-danger')
    expect(vmRow).not.toContain('onClick={handleClick}')
})
