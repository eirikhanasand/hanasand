import git from './git'

export default async function commitAndPush(message: string) {
    await git('add .')
    await git(`commit -m "${message}"`)
    await git('push')
}
