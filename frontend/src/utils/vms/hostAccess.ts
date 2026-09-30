import { cookies } from 'next/headers'
import tokenIsValid from '@/utils/proxy/tokenIsValid'

export async function canViewHostMetrics() {
    const store = await cookies()
    const id = store.get('id')?.value, token = store.get('access_token')?.value
    if (!id || !token) return false
    const session = await tokenIsValid(token, id, store.get('impersonation_token')?.value)
    return session.valid && session.canViewInternalPages === true
}
