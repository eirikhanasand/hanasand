import git, { LOCAL_REPO_PATH } from './git.ts'
import { relative } from 'path'

export default async function createdAt(filePath: string): Promise<string> {
    try {
        const relativePath = relative(LOCAL_REPO_PATH, filePath)
        const stdout = await git(`log --diff-filter=A --follow --format=%aI -- '${relativePath}'`)
        const firstLine = stdout.split('\n')[0]
        return firstLine || new Date().toString()
    } catch (error) {
        console.error(`Failed to get file created time: ${error}`)
        return new Date().toString()
    }
}
