import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('collection actions remain available without the overview', async () => {
    const manualRun = await readFile(path.join(root, 'src/app/dashboard/ti/manualRunButton.tsx'), 'utf8')
    const controlRoute = await readFile(path.join(root, 'src/app/api/ti/scraper/control/route.ts'), 'utf8')
    expect(manualRun).toContain('action: sourceId === \'all_sources\' ? \'scheduler_run_now\' : \'run_query\'')
    expect(manualRun).toContain('setState(controlResult.ok ? \'queued\' : \'idle\')')
    expect(manualRun).not.toContain('Run request recorded')
    expect(controlRoute).toContain('if (!base) return unavailable(\'TI_SCRAPER_API_BASE is not configured.\')')
    expect(controlRoute).not.toContain('hanasand_ai_scheduler_fallback')
})
