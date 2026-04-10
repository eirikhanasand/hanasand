import { cookies } from 'next/headers'
import AIPageClient from './pageClient'
import { getUserShares } from '@/utils/share/getUserShares'
import { getAiWorkspace } from '@/utils/ai/getWorkspace'

export default async function page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const shares = id && token ? await getUserShares({ id, token }) : []
    const initialShares = Array.isArray(shares) ? shares : []
    const workspace = await getAiWorkspace({ id, token })

    return (
        <AIPageClient
            initialConversations={workspace.conversations}
            initialRepositories={workspace.repositories}
            initialShares={initialShares}
            isAuthenticated={Boolean(id && token)}
        />
    )
}
