import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'content-library-test-'))
    execFileSync(process.env.BUN_BINARY || 'bun', ['build', 'tests/fixtures/content-library.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page, context }) => {
    await context.addCookies([{name:'id',value:'owner',url:'http://library.test'},{name:'access_token',value:'fixture-token',url:'http://library.test'}])
    await page.route('http://library.test/fixture.js', route => route.fulfill({contentType:'application/javascript',body:bundle}))
    await page.route('http://library.test/', route => route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'}))
})
test('library loads owned files, paginates, and exposes upload and file links', async ({page}) => {
    await page.route('**/files/user/owner?*', route => {
        expect(route.request().headers().id).toBe('owner')
        const offset = Number(new URL(route.request().url()).searchParams.get('offset'))
        return route.fulfill({json:Array.from({length:offset ? 1 : 31},(_,index) => ({id:'file-'+(offset+index),name:'Upload '+(offset+index),type:'application/pdf',uploaded_at:'2026-09-19T12:00:00Z',size_bytes:1024}))})
    })
    await page.goto('http://library.test/')
    await expect(page.getByRole('heading',{name:'Library',exact:true})).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(30)
    await expect(page.getByRole('link',{name:'Upload files'})).toHaveAttribute('href','/upload')
    await page.getByRole('button',{name:'Next',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Upload 30',exact:true})).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled()
})
test('failed requests show an error instead of an empty library and retry recovers', async ({page}) => {
    let fail = true
    await page.route('**/files/user/owner?*', route => route.fulfill({status:fail ? 503 : 200,json:fail ? {} : []}))
    await page.goto('http://library.test/')
    await expect(page.getByRole('alert')).toContainText('could not be loaded')
    await expect(page.getByText('No files yet')).toHaveCount(0)
    fail = false
    await page.getByRole('button',{name:'Try again'}).click()
    await expect(page.getByText('No files yet')).toBeVisible()
})
