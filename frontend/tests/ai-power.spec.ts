import {test,expect} from '@playwright/test'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'
let output: string, bundle: string
test.beforeAll(()=>{
    output=mkdtempSync(path.join(tmpdir(),'ai-metrics-'))
    execFileSync(process.env.BUN_BIN || 'bun',['build','tests/fixtures/ai-power.tsx','--target=browser','--define','process.env={"NODE_ENV":"production"}','--outfile',path.join(output,'fixture.js')])
    bundle=readFileSync(path.join(output,'fixture.js'),'utf8')
})
test.afterAll(()=>rmSync(output,{recursive:true,force:true}))
test('shows measured power; missing telemetry is not zero',async({page})=>{
    await page.route('http://ai.test/fixture.js',r=>r.fulfill({contentType:'application/javascript',body:bundle}))
    await page.route('http://ai.test/?**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div><script type="module" src="/fixture.js"></script>'}))
    await page.goto('http://ai.test/?measured')
    await expect(page.getByText('462 W',{exact:true}).first()).toBeVisible()
    await expect(page.getByText(/1.25 kWh recorded this month/)).toBeVisible()
    await expect(page.getByText('Cost / verified build',{exact:true})).toHaveCount(0)
    await page.goto('http://ai.test/?missing')
    await expect(page.getByText('Unavailable',{exact:true})).toBeVisible()
    await expect(page.getByText('0 W',{exact:true})).toHaveCount(0)
})
