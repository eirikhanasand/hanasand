import { cookies } from 'next/headers'
import AIPageClient from './pageClient'
import { getUserShares } from '@/utils/share/getUserShares'

export default async function page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const shares = id && token ? await getUserShares({ id, token }) : []
    const initialShares = Array.isArray(shares) ? shares : []

    return <AIPageClient initialShares={initialShares} isAuthenticated={Boolean(id && token)} />
}
