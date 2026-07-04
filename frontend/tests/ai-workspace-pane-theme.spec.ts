import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ai workspace pane action buttons use shared theme tokens', async () => {
    const source = await readFile(path.join(root, 'src/components/ai/workspacePane.tsx'), 'utf8')

    expect(source).toContain('onImportRepo()')
    expect(source).toContain('onScaffoldStarter(\'nextjs_docker\', starterName)')
    expect(source).toContain('onStartDeployment({ vmName: deployVmName')
    expect(source).toContain('bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas')

    expect(source).not.toContain('text-white')
    expect(source).not.toContain('dark:text-ui-canvas')
    expect(source).not.toMatch(/\b(?:bg|text|border)-\[#/)
    expect(source).not.toMatch(/rounded-(?:xl|2xl|3xl)/)
})
