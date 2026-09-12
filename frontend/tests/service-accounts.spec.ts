import { test } from '@playwright/test'
import assert from 'node:assert/strict'
test('service account creation and session deletion confirmation', async ({ browser, baseURL }) => {
    assert(baseURL)
    const context = await browser.newContext({viewport:{width:1280,height:1000}, extraHTTPHeaders:{'x-hanasand-render-proof-auth':'local-dashboard-render-proof'}})
    await context.addCookies([{name:'id',value:'dashboard-render-proof-user',url:baseURL},{name:'access_token',value:'local-dashboard-render-proof-token',url:baseURL},{name:'roles',value:JSON.stringify([{id:'system_admin',name:'System administrator',priority:0}]),url:baseURL}])
    let accounts=[{id:'svc_fixture',name:'Existing monitor',active:true,created_at:'2026-09-01T12:00:00Z',keys:[{lastUsedAt:'2026-09-12T12:00:00Z',scopes:[{method:'GET',route:'/api/service-accounts/self'}]}]}]
    let deletes=0, creates=0
    const endpoints=[{method:'GET',route:'/api/service-accounts/self',label:'Check authentication'},{method:'GET',route:'/api/db',label:'Read database overview'}]
    await context.route(url=>url.pathname.startsWith('/api/service-accounts'),async route=>{
        const req=route.request()
        if(req.method()==='POST'){creates++; const body=req.postDataJSON(); assert.deepEqual(body.scopes,[{method:'GET',route:'/api/db'}]);accounts.push({id:'svc_new',name:body.name,active:true,created_at:'2026-09-12T12:00:00Z',keys:[]});await route.fulfill({json:{secret:'fixture-shown-once'}})}
        else if(req.method()==='DELETE'){deletes++;accounts=accounts.filter(a=>!req.url().endsWith(a.id));await route.fulfill({json:{message:'revoked'}})}
        else await route.fulfill({json:{accounts,endpoints}})
    })
    const page=await context.newPage()
    const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`${baseURL}/management/service-accounts`)
    await page.getByText('Existing monitor',{exact:true}).waitFor()
    await page.getByLabel('Name',{exact:true}).fill('Database check')
    await page.getByLabel(/Read database overview/).check()
    await page.getByRole('button',{name:'Create service account',exact:true}).click()
    await page.getByText('fixture-shown-once',{exact:true}).waitFor()
    assert.equal(creates,1)
    await page.getByRole('button',{name:'Dismiss key'}).click()
    await page.getByRole('button',{name:'Delete Existing monitor',exact:true}).click()
    assert.equal(deletes,0)
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(),0)
    await page.getByRole('button',{name:'Delete Existing monitor',exact:true}).click()
    await page.getByRole('dialog').getByLabel('Don’t ask again for this session').check()
    await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click()
    await page.getByText('Existing monitor',{exact:true}).waitFor({state:'hidden'})
    assert.equal(deletes,1)
    await page.reload()
    await page.getByRole('button',{name:'Delete Database check',exact:true}).click()
    await page.getByText('Database check',{exact:true}).waitFor({state:'hidden'})
    assert.equal(deletes,2)
    assert.deepEqual(errors,[])
    console.log('UI passed: creation, endpoint scope payload, one-time secret, cancellation/Escape, confirmed deletion, session-only direct deletion across reload. No browser errors.')
    await context.close()
})
