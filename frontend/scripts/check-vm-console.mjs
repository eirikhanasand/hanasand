import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const css = await readFile('node_modules/@xterm/xterm/css/xterm.css', 'utf8')
const build = await Bun.build({ entrypoints: ['console-fixture'], target: 'browser', plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /^(console-fixture|next\/link|@\/config)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link(props){return <a {...props}/>}' : args.path === '@/config' ? 'export default {url:{api_wss:"ws://fixture"}}' : `
        import {createRoot} from 'react-dom/client';
        import VmConsole from './src/components/vms/consoleClient';
        window.sent=[];
        window.WebSocket=class {
            static OPEN=1; readyState=1;
            constructor(){setTimeout(()=>this.onopen?.(),0)}
            send(value){const message=JSON.parse(value);window.sent.push(message);if(message.type==='auth')setTimeout(()=>{
                this.onmessage({data:JSON.stringify({type:'ready',username:'cashflow'})});
                this.onmessage({data:JSON.stringify({type:'output',data:'copyprobe\\r\\n$ '})});
            },0)}
            close(){}
        };
        createRoot(document.getElementById('root')).render(<VmConsole name="cashflow"/>);
    ` }))
} }] })
assert(build.success, build.logs.join('\n'))
const bundle = await build.outputs[0].text()
const server = Bun.serve({ port: 0, fetch(request) {
    if (new URL(request.url).pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
    return new Response(`<html><head><style>${css} [aria-label="cashflow terminal"]{height:400px;width:800px}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`, { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ permissions: ['clipboard-read', 'clipboard-write'] })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server.url.toString())
    await page.getByRole('status').filter({ hasText: 'Connected · cashflow' }).waitFor()
    const row = page.locator('.xterm-rows > div').first()
    await row.filter({ hasText: 'copyprobe' }).waitFor()
    const select = async () => { await page.locator('.xterm-screen').dblclick({ position: { x: 20, y: 8 } }) }
    const textarea = page.locator('.xterm-helper-textarea')
    await select()
    assert.equal(await textarea.inputValue(), 'copyprobe', 'Selection must exist before Safari opens its native context menu')
    assert.deepEqual(await textarea.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 9])
    for (const shortcut of ['Control+Shift+C', 'Meta+C']) {
        await page.evaluate(() => navigator.clipboard.writeText('before'))
        await page.keyboard.press(shortcut)
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'copyprobe', shortcut)
    }
    assert.equal(await page.evaluate(() => window.sent.filter(message => message.type === 'input').length), 0, 'Copy must not send text or control characters to the shell')
    await page.locator('.xterm-screen').click({ button: 'right', position: { x: 20, y: 8 } })
    assert.equal(await textarea.inputValue(), 'copyprobe')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+C')
    assert(await page.evaluate(() => window.sent.some(message => message.type === 'input' && message.data === '\x03')), 'Ctrl+C must still interrupt commands')
    await page.keyboard.type('pwd')
    assert(await page.evaluate(() => window.sent.filter(message => message.type === 'input').map(message => message.data).join('').endsWith('pwd')))
    assert.deepEqual(errors, [])
    console.log('VM console: native selection, both copy shortcuts, right-click selection and shell input passed.')
} finally { await browser.close(); server.stop(true) }
