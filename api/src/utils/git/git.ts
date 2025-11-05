import { exec } from 'child_process'
import util from 'util'
import fs from 'fs/promises'
import config from '#constants'
import { join, resolve } from 'path'

const execAsync = util.promisify(exec)

const LOCAL_REPO_PATH = resolve('./articles')
const ARTICLES_DIR = join(LOCAL_REPO_PATH, 'articles')

export { ARTICLES_DIR }

export default async function git(cmd: string) {
    await ensureRepo()

    try {
        const { stdout, stderr } = await execAsync(`git -C '${LOCAL_REPO_PATH}' ${cmd}`)
        if (stderr) {
            console.error(stderr)
        }

        return stdout.trim()
    } catch (error) {
        console.error(`Git command failed: git ${cmd}: ${error}`)
        throw error
    }
}

async function ensureRepo() {
    try {
        await fs.access(LOCAL_REPO_PATH)
    } catch {
        console.log('Cloning repository...')
        await execAsync(`git clone ${config.github_articles_ssh} '${LOCAL_REPO_PATH}'`)
    }

    await fs.access(join(LOCAL_REPO_PATH, '.git'))

    const { stdout: head } = await execAsync(`git -C '${LOCAL_REPO_PATH}' remote show origin`)
    const match = head.match(/HEAD branch: (.+)/)
    const defaultBranch = match ? match[1].trim() : 'main'

    try {
        await execAsync(`git -C '${LOCAL_REPO_PATH}' checkout ${defaultBranch}`)
    } catch {
        await execAsync(`git -C '${LOCAL_REPO_PATH}' checkout -b ${defaultBranch} origin/${defaultBranch}`)
    }

    try {
        await execAsync(`git -C '${LOCAL_REPO_PATH}' branch --set-upstream-to=origin/${defaultBranch} ${defaultBranch}`)
    } catch (e) {
        console.warn(`Could not set upstream for ${defaultBranch}:`, e)
    }
}
