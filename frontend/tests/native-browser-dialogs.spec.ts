import { expect, test } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.join(process.cwd(), 'src')
const nativeDialogPattern = /\bwindow\.(confirm|alert|prompt)\s*\(|(?<![\w.])(confirm|alert|prompt)\s*\(/g

test('frontend uses app dialogs instead of native browser dialogs', async () => {
    const offenders: string[] = []

    for (const file of await sourceFiles(root)) {
        const source = stripStrings(await readFile(file, 'utf8'))
        if (nativeDialogPattern.test(source)) offenders.push(path.relative(process.cwd(), file))
        nativeDialogPattern.lastIndex = 0
    }

    expect(offenders).toEqual([])
})

async function sourceFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) return sourceFiles(fullPath)
        return /\.(tsx?|jsx?)$/.test(entry.name) ? [fullPath] : []
    }))
    return files.flat()
}

function stripStrings(source: string) {
    return source.replace(/(['"`])(?:\\[\s\S]|(?!\1)[\s\S])*?\1/g, '')
}
