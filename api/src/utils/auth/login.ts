import { issueToken } from './session.ts'

export default async function login({ id, ip }: { id: string, ip: string }) {
    return issueToken({ id, ip })
}
