import git from './git.ts'
import { relative } from 'path'
import { resolve } from 'path'
const LOCAL_REPO_PATH = resolve('./articles')

export default async function updatedAt(filePath: string): Promise<string> {
    try {
        const relativePath = relative(LOCAL_REPO_PATH, filePath)
        const stdoutCreated = await git(`log --diff-filter=A --follow --format=%aI -- '${relativePath}'`)
        const stdoutUpdated = await git(`log -1 --format=%aI -- '${relativePath}'`)
        const firstLineCreated = stdoutCreated.split('\n')[0]
        const firstLineUpdated = stdoutUpdated.split('\n')[0]
        return firstLineUpdated ?? firstLineCreated ?? new Date().toISOString()
    } catch (error) {
        console.error(`Failed to get file updated time: ${error}`)
        return new Date().toISOString()
    }
}
