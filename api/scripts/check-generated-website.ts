import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

const prompt = 'Build a website called "Field & Form" with services, pricing and contact details.'
const response = buildShareProjectResponse(prompt)!
const files = [...response.message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map(match => JSON.parse(match[1]) as { path: string, content: string })
const content = (name: string) => {
    const file = files.find(item => item.path === name)
    assert.ok(file, `Missing ${name}`)
    return file.content
}
assert.match(content('README.md'), /npm run build/)
assert.match(content('README.md'), /does not collect form submissions/)
assert.match(content('src/app/layout.tsx'), /import '\.\/globals.css'/)
assert.match(content('src/app/page.tsx'), /Skip to content/)
assert.match(content('src/app/page.tsx'), /tabIndex=\{-1\}/)
assert.doesNotMatch(content('src/app/page.tsx'), /<form|98%|4\.9|skeptical client|production seam/)
assert.match(content('src/app/globals.css'), /:focus-visible/)
assert.match(content('src/app/globals.css'), /minmax\(min\(100%/)
assert.ok(files.some(file => file.path.startsWith('public/')), 'Docker public directory must exist')
assert.doesNotMatch(content('.github/workflows/ci.yml'), /cache: npm/, 'First build must not require a lockfile that has not been generated')
assert.equal(buildShareProjectResponse(prompt)?.message, response.message, 'Cache must preserve the complete project')
for (const kind of ['API', 'Discord bot', 'worker queue']) {
    const project = buildShareProjectResponse(`Build a ${kind} with Docker`)!
    assert.match(project.message, /README\.md/)
    assert.match(project.message, /src\/index\.ts/)
}
if (process.env.GENERATED_WEBSITE_DIR) {
    for (const file of files) {
        const target = path.join(process.env.GENERATED_WEBSITE_DIR, file.path)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, file.content)
    }
}
console.log('Generated website files, copy, styles and cache checks passed.')
