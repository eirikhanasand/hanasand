import { readFile } from 'node:fs/promises'

const workbenchPath = new URL('../src/components/ai/useAiWorkbench.ts', import.meta.url)
const conversationActionsPath = new URL('../src/components/ai/workbench/useConversationActions.ts', import.meta.url)
const workbenchSource = await readFile(workbenchPath, 'utf8')
const conversationActionsSource = await readFile(conversationActionsPath, 'utf8')

const requiredPatterns = [
    ['patchConversation useCallback', conversationActionsSource, /const\s+patchConversation\s*=\s*useCallback\(/],
    ['attachShare useCallback', workbenchSource, /const\s+attachShare\s*=\s*useCallback\(/],
    ['selectShareFile useCallback', workbenchSource, /const\s+selectShareFile\s*=\s*useCallback\(/],
]

const failures = requiredPatterns
    .filter(([, source, pattern]) => !pattern.test(source))
    .map(([label]) => label)

if (failures.length) {
    console.error('AI hook stability check failed:')
    for (const failure of failures) {
        console.error(`- Missing ${failure}`)
    }
    process.exit(1)
}

console.log('AI hook stability check passed.')
