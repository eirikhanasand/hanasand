import { readFile } from 'node:fs/promises'

const filePath = new URL('../src/components/ai/useAiWorkbench.ts', import.meta.url)
const source = await readFile(filePath, 'utf8')

const requiredPatterns = [
    ['patchConversation useCallback', /const\s+patchConversation\s*=\s*useCallback\(/],
    ['attachShare useCallback', /const\s+attachShare\s*=\s*useCallback\(/],
    ['selectShareFile useCallback', /const\s+selectShareFile\s*=\s*useCallback\(/],
]

const failures = requiredPatterns
    .filter(([, pattern]) => !pattern.test(source))
    .map(([label]) => label)

if (failures.length) {
    console.error('AI hook stability check failed:')
    for (const failure of failures) {
        console.error(`- Missing ${failure}`)
    }
    process.exit(1)
}

console.log('AI hook stability check passed.')
