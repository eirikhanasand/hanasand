import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('service check stats uses shared theme tokens', async () => {
    const source = await readFile(path.join(root, 'src/app/test/stats/pageClient.tsx'), 'utf8')

    expect(source).toContain('Service check results')
    expect(source).toContain('ChartColumn className=\'h-4 w-4 text-ui-primary\'')
    expect(source).toContain('bg-ui-text px-3 text-sm font-semibold text-ui-canvas')

    expect(source).not.toContain('stroke-[#3056d3]')
    expect(source).not.toMatch(/\b(?:bg|text|border|stroke|fill|divide)-\[#/)
})
