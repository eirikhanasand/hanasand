import { expect, test } from '@playwright/test'

const organizations = [{id:'org-one',name:'First organization',role:'owner',lifecycleStatus:'active'}]

test.beforeEach(async ({ context, baseURL }) => {
    await context.setExtraHTTPHeaders({'x-hanasand-render-proof-auth':'local-dashboard-render-proof'})
    await context.addCookies([
        {name:'id',value:'dashboard-render-proof-user',url:baseURL!},
        {name:'access_token',value:'local-dashboard-render-proof-token',url:baseURL!},
        {name:'roles',value:JSON.stringify([{id:'system_admin',name:'System administrator',priority:0}]),url:baseURL!},
        {name:'hanasand_workspace',value:JSON.stringify({userId:'dashboard-render-proof-user',organizationId:'org-one',name:'First organization'}),httpOnly:true,url:baseURL!},
    ])
    await context.route('**/api/service-accounts', route=>route.fulfill({json:{accounts:[],endpoints:[]}}))
    await context.route('**/api/workspace-organization', route=>route.fulfill({json:{workspace:{userId:'dashboard-render-proof-user',organizationId:'org-one',name:'First organization'}}}))
})

test('organization list recovers from transient failures without changing workspace', async ({page}) => {
    let requests = 0
    await page.route('**/api/organizations', route=> {
        requests++
        if (requests === 2) return route.abort('failed')
        return route.fulfill(requests <= 2 ? {status:503,json:{error:'Temporarily unavailable'}} : {json:{organizations}})
    })
    await page.goto('/management/service-accounts')
    const select = page.getByRole('combobox',{name:'Org',exact:true})
    await expect(select).toBeDisabled()
    await expect(select.locator('option:checked')).toHaveText('First organization')
    await expect(page.getByText('Organization unavailable',{exact:true})).toHaveCount(0)
    await expect(select).toBeEnabled({timeout:10000})
    expect(requests).toBe(3)
    await expect(select).toHaveValue('org-one')
    await expect(page.getByRole('alert').filter({hasText:'Organizations could not be loaded.'})).toHaveCount(0)
})

test('persistent organization failures stop retrying and recover manually or on return', async ({page}) => {
    test.setTimeout(60000)
    let requests = 0
    let fail = true
    await page.route('**/api/organizations', route=> {
        requests++
        return route.fulfill(fail ? {status:500,json:{error:'Database connection timed out'}} : {json:{organizations}})
    })
    await page.goto('/management/service-accounts')
    const select = page.getByRole('combobox',{name:'Org',exact:true})
    const retry = page.getByRole('button',{name:'Retry organizations'})
    await expect(retry).toBeVisible({timeout:10000})
    await expect(select).toBeDisabled()
    expect(requests).toBe(3)
    await page.clock.install()
    await page.clock.runFor(10000)
    expect(requests).toBe(3)
    fail = false
    await retry.click()
    await expect(select).toBeEnabled()
    await expect(retry).toHaveCount(0)
    await expect(select).toHaveValue('org-one')
    expect(requests).toBe(4)
    for (const event of ['focus','online']) {
        fail = true; requests = 0
        await page.reload()
        await expect(retry).toBeVisible({timeout:10000})
        expect(requests).toBe(3)
        fail = false
        await page.evaluate(name=>window.dispatchEvent(new Event(name)), event)
        await expect(select).toBeEnabled()
        await expect(retry).toHaveCount(0)
        await expect(select).toHaveValue('org-one')
        expect(requests).toBe(4)
    }
})

test('expired sessions do not retry automatically or enable organization access', async ({page}) => {
    let requests = 0
    await page.route('**/api/organizations', route=> { requests++; return route.fulfill({status:401,json:{error:'Unauthorized'}}) })
    await page.goto('/management/service-accounts')
    await expect(page.getByRole('alert').filter({hasText:'Your session expired.'})).toBeVisible()
    await expect(page.getByRole('combobox',{name:'Org',exact:true})).toBeDisabled()
    await page.clock.install()
    await page.clock.runFor(10000)
    expect(requests).toBe(1)
})

for (const width of [320, 375, 430, 768, 1024, 1280, 1536]) test(`organization switch stays visible and usable on all signed-in surfaces at ${width}px`, async ({page,context,baseURL}) => {
    await page.setViewportSize({width,height:900})
    await page.route('**/api/organizations',route=>route.fulfill({json:{organizations}}))
    let current = 'org-one'
    await page.route('**/api/workspace-organization',async route=>{
        if(route.request().method()==='POST'){
            current=route.request().postDataJSON().org
            await context.addCookies([{name:'hanasand_workspace',value:JSON.stringify({userId:'dashboard-render-proof-user',organizationId:current,name:current?'First organization':'Personal workspace'}),httpOnly:true,url:baseURL!}])
        }
        await route.fulfill({json:{workspace:{userId:'dashboard-render-proof-user',organizationId:current,name:current?'First organization':'Personal workspace'}}})
    })
    for(const path of ['/','/docs','/management/service-accounts']){
        await page.goto(path)
        const select=page.getByRole('combobox',{name:'Org',exact:true})
        await expect(select).toBeVisible(); await expect(select).toBeEnabled()
        await expect(page.locator('details[open]')).toHaveCount(0)
        const box=await select.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width)
        const logo=await page.locator('[data-site-header] a[href="/"] img').boundingBox(); expect(logo!.width).toBeGreaterThanOrEqual(35); expect(logo!.x+logo!.width).toBeLessThanOrEqual(box!.x)
        const header=page.locator('[data-site-header]')
        expect(await header.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
        await select.selectOption(''); await expect(select).toBeEnabled(); await expect(select).toHaveValue('')
        await select.selectOption('org-one'); await expect(select).toBeEnabled(); await expect(select).toHaveValue('org-one')
        await page.reload(); await expect(page.getByRole('combobox',{name:'Org',exact:true})).toHaveValue('org-one')
    }
})

test('signed-out pages do not show or load organizations',async({page,context})=>{
    await context.clearCookies()
    let requests=0
    await page.route('**/api/organizations',route=>{requests++;return route.fulfill({json:{organizations}})})
    await page.goto('/')
    await expect(page.getByRole('combobox',{name:'Org',exact:true})).toHaveCount(0)
    expect(requests).toBe(0)
})
