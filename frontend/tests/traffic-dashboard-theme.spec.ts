import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('traffic dashboard summary lanes use shared theme tokens', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/traffic/page.tsx'), 'utf8')
    const client = await readFile(path.join(root, 'src/app/dashboard/traffic/pageClient.tsx'), 'utf8')
    const recentLogs = await readFile(path.join(root, 'src/components/traffic/recentLogs.tsx'), 'utf8')
    const speedometer = await readFile(path.join(root, 'src/components/traffic/speedometer.tsx'), 'utf8')
    const trafficMap = await readFile(path.join(root, 'src/components/monitoring/traffic/trafficMap.tsx'), 'utf8')
    const liveMapPrimitives = await readFile(path.join(root, 'src/components/monitoring/traffic/liveMapPrimitives.tsx'), 'utf8')
    const trafficMapSources = `${trafficMap}\n${liveMapPrimitives}`

    expect(page).toContain('DashboardPage')
    expect(page).toContain('DashboardHeader')
    expect(page).toContain('border-ui-border bg-ui-raised')
    expect(page).toContain('text-ui-success')
    expect(page).toContain('text-ui-warning')
    expect(page).toContain('text-ui-danger')
    expect(page).toContain('text-ui-primary')

    expect(page).not.toMatch(/\b(?:bg|text|border|ring|outline)-\[#/)
    expect(page).not.toMatch(/\bshadow-\[/)
    expect(client).toContain('bg-ui-primary')
    expect(client).toContain('text-ui-canvas')
    expect(client).not.toContain('text-white')

    expect(recentLogs).toContain('bg-ui-panel')
    expect(recentLogs).toContain('border-ui-border')
    expect(recentLogs).not.toMatch(/\b(?:bg|text|border)-(?:dark|bright|neutral)-?/)

    expect(speedometer).toContain('var(--ui-success)')
    expect(speedometer).toContain('border-ui-border bg-ui-panel')
    expect(speedometer).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    expect(trafficMapSources).toContain('Live traffic map')
    expect(trafficMapSources).toContain('border-ui-border')
    expect(trafficMapSources).toContain('bg-ui-panel')
    expect(trafficMapSources).not.toMatch(/rounded-(?:xl|2xl|3xl)/)
})
