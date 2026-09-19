import git from './git.ts'

export default async function commitAndPush(message: string) {
    await git('add .')
    if (!(await git('diff --cached --name-only'))) return
    await git(`commit -m '${message}'`)
    // A standalone persistent article repository keeps local history without a remote.
    if ((await git('remote')).split('\n').includes('origin')) await git('push')
}
