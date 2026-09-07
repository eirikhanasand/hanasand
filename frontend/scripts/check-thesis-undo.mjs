import assert from 'node:assert/strict'
import path from 'node:path'
import { chromium } from '@playwright/test'

const build = await Bun.build({
    entrypoints: ['thesis-undo-test'], target: 'browser', define: { 'process.env': '{}' },
    plugins: [{ name: 'thesis-undo-test', setup(builder) {
        builder.onResolve({ filter: /^thesis-undo-test$/ }, () => ({ path: 'entry', namespace: 'fixture' }))
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `
            import { createElement, useState } from ${JSON.stringify(path.resolve('node_modules/react'))};
            import { createRoot } from ${JSON.stringify(path.resolve('node_modules/react-dom/client'))};
            import useThesis from ${JSON.stringify(path.resolve('src/app/thesis/useThesis.ts'))};
            function Editor() {
                const [initial, setInitial] = useState({title:'# Timetable', body:'week 28\\nweek 29', revision:1});
                const thesis = useThesis(initial, true);
                return createElement('div', null,
                    createElement('output', {id:'body'}, thesis.document.body),
                    createElement('output', {id:'conflict'}, String(thesis.conflict)),
                    createElement('button', {onClick:()=>thesis.update('body','week 29')}, 'Remove week'),
                    createElement('button', {onClick:()=>thesis.flush()}, 'Save'),
                    createElement('button', {onClick:async()=>setInitial(await (await fetch('/api/thesis')).json())}, 'Refresh server data'),
                    createElement('button', {onClick:thesis.undo, disabled:!thesis.canUndo}, 'Undo'),
                    createElement('button', {onClick:thesis.redo, disabled:!thesis.canRedo}, 'Redo'));
            }
            createRoot(document.getElementById('root')).render(createElement(Editor));` }))
    } }],
})
assert.equal(build.success, true, String(build.logs))
const browser = await chromium.launch()
try {
    const page = await browser.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', error => console.error(error.message))
    await page.routeWebSocket('**/*', socket => socket.close())
    let document = { title: '# Timetable', body: 'week 28\nweek 29', revision: 1 }
    await page.route('**/*', async route => {
        if (new URL(route.request().url()).pathname === '/api/thesis') {
            if (route.request().method() === 'PUT') document = { ...route.request().postDataJSON(), revision: document.revision + 1 }
            return route.fulfill({ json: document })
        }
        if (new URL(route.request().url()).pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: await build.outputs[0].text() })
        return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' })
    })
    await page.goto('http://thesis-undo.test')
    await page.getByRole('button', { name: 'Remove week', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForFunction(() => !localStorage.length)
    await page.getByRole('button', { name: 'Refresh server data', exact: true }).click()
    await page.waitForTimeout(100)
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), true)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.equal(await page.locator('#body').textContent(), 'week 28\nweek 29')
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    assert.equal(await page.locator('#body').textContent(), 'week 29')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    document = { ...document, revision: document.revision + 1, body: 'another editor changed the plan' }
    await page.getByRole('button', { name: 'Refresh server data', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#conflict')?.textContent === 'true')
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), false)
    assert.equal(await page.locator('#body').textContent(), 'week 28\nweek 29')
    console.log('Thesis Undo survives server refresh; remote edit conflicts remain protected.')
} finally { await browser.close() }
