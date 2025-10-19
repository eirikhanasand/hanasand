import git from './git.ts'

export async function createdAt(filePath: string): Promise<string | null> {
    try {
        const stdout = await git(`log --diff-filter=A --follow --format=%aI -- "${filePath}"`)
        const firstLine = stdout.split('\n')[0]
        return firstLine || null
    } catch (err) {
        console.error('Failed to get file created time', err)
        return null
    }
}
