import { issueToken } from './session.ts'

export default async function login({ id, ip, userAgent = '' }: { id: string, ip: string, userAgent?: string }) {
    return issueToken({ id, ip, userAgent })
}
