import { cookies } from 'next/headers'
import AIPageClient from '../pageClient'
import { getUserShares } from '@/utils/share/getUserShares'
import { getAiWorkspace } from '@/utils/ai/getWorkspace'

export default async function AIConversationPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    const shares = id && token ? await getUserShares({ id, token }) : []
    const initialShares = Array.isArray(shares) ? shares : []
    const workspace = await getAiWorkspace({ id, token })
    const conversationId = (await params).id

    return (
        <AIPageClient
            initialConversations={workspace.conversations}
            initialRepositories={workspace.repositories}
            initialDeployments={workspace.deployments}
            initialReleases={workspace.releases}
            initialDeployQuota={workspace.deployQuota}
            initialOwnershipSummary={workspace.ownershipSummary}
            initialShares={initialShares}
            initialRuntimeState={workspace.runtimeState}
            isAuthenticated={Boolean(id && token)}
            initialConversationId={conversationId}
            mode='workspace'
        />
    )
}
