import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('traffic routes separate overview, recent requests, map, and blocklist', async () => {
    const overviewPage = await readFile(path.join(root, 'src/app/dashboard/traffic/page.tsx'), 'utf8')
    const overviewClient = await readFile(path.join(root, 'src/components/monitoring/traffic/trafficOverview.tsx'), 'utf8')
    const recentPage = await readFile(path.join(root, 'src/app/dashboard/traffic/recent/page.tsx'), 'utf8')
    const recentClient = await readFile(path.join(root, 'src/app/dashboard/traffic/recent/pageClient.tsx'), 'utf8')
    const mapPage = await readFile(path.join(root, 'src/app/dashboard/traffic/map/page.tsx'), 'utf8')
    const blocklistPage = await readFile(path.join(root, 'src/app/dashboard/traffic/blocklist/page.tsx'), 'utf8')
    const blocklistClient = await readFile(path.join(root, 'src/app/dashboard/traffic/blocklist/blocklistClient.tsx'), 'utf8')
    const trafficMap = await readFile(path.join(root, 'src/components/monitoring/traffic/trafficMap.tsx'), 'utf8')
    const liveMapPrimitives = await readFile(path.join(root, 'src/components/monitoring/traffic/liveMapPrimitives.tsx'), 'utf8')
    const trafficCharts = await readFile(path.join(root, 'src/components/monitoring/traffic/traffic.tsx'), 'utf8')
    const combinedMetrics = await readFile(path.join(root, 'src/components/monitoring/traffic/combinedMetrics.tsx'), 'utf8')
    const trafficMapSources = `${trafficMap}\n${liveMapPrimitives}`
    const trafficChartSources = `${trafficCharts}\n${combinedMetrics}`

    expect(overviewPage).toContain('DashboardPage')
    expect(overviewPage).toContain('Traffic overview')
    expect(overviewClient).toContain('<TrafficDashboard metrics={metrics}')
    expect(overviewClient).not.toContain('<TrafficMap')
    expect(overviewClient).not.toContain('RecentTrafficTable')
    expect(overviewClient).toContain('bg-ui-raised')
    expect(overviewClient).toContain('text-ui-success')
    expect(overviewClient).toContain('text-ui-warning')
    expect(overviewClient).toContain('text-ui-primary')

    expect(recentPage).toContain('TrafficRecentClient')
    expect(recentClient).toContain('RecentTrafficTable')
    expect(recentClient).toContain('mode: \'snapshot\'')
    expect(mapPage).toContain('<TrafficMap')
    expect(trafficMapSources).toContain('Live traffic map')
    expect(trafficMapSources).toContain('border-ui-border')
    expect(trafficMapSources).toContain('bg-ui-panel')
    expect(trafficMapSources).not.toMatch(/rounded-(?:xl|2xl|3xl)/)

    expect(blocklistPage).toContain('BlocklistClient')
    expect(blocklistClient).toContain('Add blocklist entry')
    expect(blocklistClient).toContain('bg-ui-primary')
    expect(blocklistClient).toContain('border-ui-border bg-ui-panel')
    expect(blocklistClient).toContain('text-ui-danger')

    expect(trafficChartSources).toContain('Requests Over Time')
    expect(trafficChartSources).toContain('Recent traffic')
    expect(trafficChartSources).toContain('border-ui-border bg-ui-panel')
    expect(trafficChartSources).toContain('shadow-sm')
    expect(trafficChartSources).not.toMatch(/\bshadow-\[/)
})
