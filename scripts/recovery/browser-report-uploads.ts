#!/usr/bin/env node
/** Allow screenshot reports through the existing frontend/API proxy routes. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.argv[2]
if (!root) throw new Error('Usage: browser-report-uploads.ts NGINX_CONFIG_ROOT')
const previous = new Map()
for (const name of ['default.conf', 'recovery-upstreams.conf']) {
    const file = path.join(root, 'conf.d', name)
    const source = readFileSync(file, 'utf8')
    const blocks = source.split(/(?<=\n})\s*(?=server \{)/)
    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index]
        if (block.includes('browser-report-upload')) continue
        let route
        let upstream
        if (/server_name\s+hanasand\.com(?:\s+www\.hanasand\.com)?;/.test(block)) [route, upstream] = ['/api/backend/browser/runs/', 'frontend']
        else if (/server_name\s+api\.hanasand\.com;/.test(block)) [route, upstream] = ['/api/browser/runs/', 'api']
        else continue
        const location = `\n    # browser-report-upload: keep other request limits unchanged.\n    location ~ ^${route}[^/]+/report$ {\n        client_max_body_size 32m;\n        proxy_pass http://hanasand_recovery_${upstream};\n        include snippets/proxy-headers.conf;\n    }\n`
        blocks[index] = block.replace('    location / {', location + '\n    location / {')
    }
    const updated = blocks.join('\n\n')
    if (updated !== source) {
        previous.set(file, source)
        writeFileSync(file, updated)
    }
}
try {
    execFileSync('docker', ['exec', 'openresty', 'nginx', '-t'], { stdio: 'inherit' })
    execFileSync('docker', ['exec', 'openresty', 'nginx', '-s', 'reload'], { stdio: 'inherit' })
} catch (error) {
    for (const [file, source] of previous) writeFileSync(file, source)
    throw error
}
