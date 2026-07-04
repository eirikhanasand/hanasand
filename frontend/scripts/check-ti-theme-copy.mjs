import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tiPage = readFileSync(path.join(root, 'src/app/ti/pageClient.tsx'), 'utf8')

const requiredSemanticChipTokens = [
    'dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary',
    'dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success',
    'dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning',
    'dark:border-ui-danger/35 dark:bg-ui-danger/10 dark:text-ui-danger',
]

for (const token of requiredSemanticChipTokens) {
    assert.ok(tiPage.includes(token), `Public TI semantic dark-mode chip token is missing: ${token}`)
}

assert.equal(tiPage.includes('divide-[#eef1f5]'), false, 'Public TI should use shared divider tokens instead of bespoke light dividers')
assert.equal(tiPage.includes('dark:divide-[#273244]'), false, 'Public TI should use shared divider tokens instead of bespoke dark dividers')

for (const token of [
    'fill-[#6d28d9]',
    'fill-[#8b5cf6]',
    'fill-[#b42318]',
    'fill-[#f04438]',
    'fill-[#e9eff7]',
    'stroke-white',
    'stroke-[#c9d5e6]',
    'stroke=\'#d92d20\'',
    'fill=\'#ffffff\'',
    'dark:fill-[#0b111a]',
]) {
    assert.equal(tiPage.includes(token), false, `Public TI actor map should use semantic SVG tokens instead of ${token}`)
}

const riskyLightChipPatterns = [
    /className=['"`][^'"`]*bg-\[#eef3ff\][^'"`]*text-\[#3056d3\](?![^'"`]*dark:bg)(?![^'"`]*dark:text)/g,
    /className=['"`][^'"`]*bg-\[#f2f4f7\][^'"`]*text-\[#475467\](?![^'"`]*dark:bg)(?![^'"`]*dark:text)/g,
    /return ['"`][^'"`]*bg-\[#e9f8ef\][^'"`]*text-\[#147a3b\](?![^'"`]*dark:bg)(?![^'"`]*dark:text)/g,
    /return ['"`][^'"`]*bg-\[#fff1f0\][^'"`]*text-\[#b42318\](?![^'"`]*dark:bg)(?![^'"`]*dark:text)/g,
]

for (const pattern of riskyLightChipPatterns) {
    assert.equal(pattern.test(tiPage), false, `Public TI has a light chip without dark-mode contrast: ${pattern}`)
}

const bannedCustomerCopy = [
    />blocked</i,
    /'blocked'/i,
    /"blocked"/i,
    /\bblocked until\b/i,
    /\bdelivery blocked\b/i,
    /\breplay blocked\b/i,
    /\bcase handoff blocked\b/i,
    /\baction required\b/i,
    /\bneeds action\b/i,
    /\bneeds proof\b/i,
    /\bneeds work\b/i,
]

const uiLabelFunctions = [
    /function decisionStepStatusLabel[\s\S]*?\n}\n/,
    /function sourceActivationActionLabel[\s\S]*?\n}\n/,
    /function sourceActivationExecutionLabel[\s\S]*?\n}\n/,
]

for (const fnPattern of uiLabelFunctions) {
    const match = tiPage.match(fnPattern)
    assert.ok(match, `Could not find UI label function guarded by ${fnPattern}`)
    for (const banned of bannedCustomerCopy) {
        assert.equal(banned.test(match[0]), false, `Customer-facing TI label function still renders blocked/dead-end copy: ${banned}`)
    }
}

for (const banned of [
    /\{blockedCount\} blocked/g,
    /'Case handoff blocked'/g,
    /'Replay export blocked'/g,
    /'Keep blocked'/g,
    /'delivery blocked'/g,
    /'replay blocked'/g,
    /'case replay blocked'/g,
]) {
    assert.equal(banned.test(tiPage), false, `Public TI should not render dead-end blocker copy: ${banned}`)
}

console.log('[ti-theme-copy] public TI contrast and customer-facing copy guard passed')
