import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const incident = { id: 'report', service: 'Monitoring', check_name: 'Latest activity', title: 'Activity delayed', status: 'resolved', impact: 'Outage', started_at: '2026-09-11T00:00:00Z', resolved_at: '2026-09-12T00:00:00Z', summary: 'Activity was delayed.', cause: 'No confirmed cause.', updates: Array.from({length: 1001}, (_, i) => ({ at: new Date(Date.parse('2026-09-11T00:00:00Z') + i * 60000).toISOString(), status: 'monitoring', message: `Update ${i}`, evidence: `Evidence ${i}` })) }
let requests = []
let bundle = ''
const payload = active => ({checks: [], history: [], incidents: [{...incident, status: active ? 'investigating' : 'resolved'}], history_available: true})
const server = Bun.serve({port: 0, fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/app.js') return new Response(bundle, {headers: {'content-type': 'text/javascript'}})
    if (url.pathname === '/api/status') { requests.push(url.search); return Response.json(payload(false)) }
    return new Response('<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>', {headers:{'content-type':'text/html'}})
}})
const build = await Bun.build({entrypoints:['incident-fixture'], target:'browser', plugins:[{name:'fixture',setup(builder) {
    builder.onResolve({filter:/^(incident-fixture|next\/link)$/}, args=>({path:args.path,namespace:'fixture'}))
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'tsx',resolveDir:process.cwd(),contents:args.path==='next/link' ? 'export default function Link(props){return <a {...props}/>}' : `
        import {createRoot} from 'react-dom/client'; import StatusDashboard from './src/app/status/pageClient';
        const payload=${JSON.stringify(payload(false))}; if(location.search) payload.incidents[0].status='investigating';
        createRoot(document.getElementById('root')).render(<StatusDashboard serviceStatus={payload} mode='incident' incidentId='report'/>);
    `}))
}}]})
assert(build.success,build.logs.join('\n')); bundle=await build.outputs[0].text()
const browser=await chromium.launch()
try {
    const page=await browser.newPage()
    await page.clock.install()
    await page.addInitScript(()=>{ window.storageAccesses=0; Storage.prototype.getItem=()=>{window.storageAccesses++;return null};Storage.prototype.setItem=()=>{window.storageAccesses++} })
    await page.goto(server.url.toString())
    await page.getByRole('article').waitFor()
    assert.equal(await page.locator('li').count(),25)
    assert.match(await page.locator('li').first().innerText(),/Update 1000/)
    await page.getByRole('button',{name:/Show older updates/}).click()
    assert.equal(await page.locator('li').count(),50)
    await page.clock.runFor(61_000)
    assert.deepEqual(requests,[],'Resolved incidents must not reload the full status feed')
    assert.equal(await page.evaluate(()=>window.storageAccesses),0)
    await page.goto(server.url.toString()+'?active')
    await page.getByRole('article').waitFor()
    await page.clock.runFor(30_100)
    await page.getByText('Resolved',{exact:true}).waitFor()
    assert.deepEqual(requests,['?incident=report'])
    await page.clock.runFor(61_000)
    assert.equal(requests.length,1,'Polling stops after recovery')
    assert.equal(await page.evaluate(()=>window.storageAccesses),0)
    console.log('Passed: bounded timeline, no dashboard/storage work, scoped active refresh, polling stops on resolution.')
} finally {await browser.close();server.stop(true)}
