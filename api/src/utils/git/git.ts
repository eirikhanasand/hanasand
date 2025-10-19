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
        const { stdout, stderr } = await execAsync(`git -C "${LOCAL_REPO_PATH}" ${cmd}`)
        if (stderr) {
            console.error(stderr)
        }

        return stdout.trim()
    } catch (err) {
        console.error(`Git command failed: git ${cmd}`, err)
        throw err
    }
}


async function ensureRepo() {
    try {
        await fs.access(LOCAL_REPO_PATH)
    } catch {
        console.log('Cloning repository...')
        await execAsync(`GIT_SSH_COMMAND="ssh -v" git clone ${config.github_articles_ssh} "${LOCAL_REPO_PATH}"`)
    }

    try {
        await fs.access(join(LOCAL_REPO_PATH, '.git'))
    } catch {
        throw new Error(`${LOCAL_REPO_PATH} exists but is not a Git repository!`)
    }

    try {
        await execAsync(`git -C "${LOCAL_REPO_PATH}" rev-parse --abbrev-ref --symbolic-full-name @{u}`)
    } catch {
        console.log('Setting upstream to origin/main...')
        await execAsync(`git -C "${LOCAL_REPO_PATH}" branch --set-upstream-to=origin/main main`)
    }
}
