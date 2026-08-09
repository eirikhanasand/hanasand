import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'bun:test'

test('renders a real cases overview without workflow sections', async () => {
    const frontendRoot = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const [portal, route] = await Promise.all([
        readFile(path.join(frontendRoot, 'src/app/dashboard/dwm/dwm-analyst-portal.tsx'), 'utf8'),
        readFile(path.join(frontendRoot, 'src/app/api/cases/route.ts'), 'utf8'),
    ])

    assert.match(portal, /function CaseOverview\(/)
    assert.match(portal, /data-dwm-cases-empty='true'/)
    assert.match(portal, />No cases\.<\/div>/)
    assert.match(portal, /data-dwm-cases-table='true'/)
    assert.match(portal, /Title \/ actor/)
    assert.match(portal, /Organization \/ victim/)
    assert.match(portal, /Severity \/ status/)
    assert.match(portal, /First seen \/ updated/)
    assert.match(portal, /Review/)
    assert.match(portal, /view === 'cases' \? null/)
    assert.match(portal, /fetch\(`\/api\/cases\?\$\{params\.toString\(\)\}`/)

    const casesBranch = portal.slice(portal.indexOf('if (view === \'cases\')'), portal.indexOf('function CaseOverview'))
    const casesComponent = portal.slice(portal.indexOf('function CaseOverview'), portal.indexOf('function DwmPanelPage'))
    assert.match(casesBranch, /CaseOverview/)
    assert.doesNotMatch(casesComponent, /DwmWorkflowActions|watchlist|webhook|collection/i)
    assert.match(route, /proxyTiRequest\(request, '\/v1\/cases'/)
})
