import git from './git.ts'

export default async function commitAndPush(message: string) {
    await git('add .')
    await git(`commit -m '${message}'`)
    await git('push')
}
