import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tiPage = readFileSync(path.join(root, 'src/app/ti/pageClient.tsx'), 'utf8')

const requiredDarkTokens = [
    'dark:border-[#4a68a8] dark:bg-[#172646] dark:text-[#b8c8ff]',
    'dark:border-[#314057] dark:bg-[#1d2939] dark:text-[#c6d3e4]',
    'dark:border-[#23563a] dark:bg-[#10281b] dark:text-[#9df0b8]',
    'dark:border-[#7f2c35] dark:bg-[#321316] dark:text-[#ffb8b0]',
    'dark:border-[#6f5417] dark:bg-[#2a220f] dark:text-[#ffd879]',
]

for (const token of requiredDarkTokens) {
    assert.ok(tiPage.includes(token), `Public TI dark-mode contrast token is missing: ${token}`)
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
