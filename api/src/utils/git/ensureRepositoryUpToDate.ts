import git from './git.ts'

export default async function ensureRepositoryUpToDate() {
    try {
        await git('rev-parse --abbrev-ref --symbolic-full-name @{u}')
    } catch {
        console.log('Setting upstream to origin/main')
        await git('branch --set-upstream-to=origin/main main')
    }

    await git('pull --rebase')
}
