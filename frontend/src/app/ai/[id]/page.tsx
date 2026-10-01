import { cookies } from 'next/headers'
import AIPageClient from '../pageClient'
import { getUserShares } from '@/utils/share/getUserShares'
import { getAiWorkspace } from '@/utils/ai/getWorkspace'

export default async function AIConversationPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const [Cookies, routeParams] = await Promise.all([cookies(), params])
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    const [shares, workspace] = await Promise.all([
        id && token ? getUserShares({ id, token }) : Promise.resolve([]),
        getAiWorkspace({ id, token }),
    ])
    const initialShares = Array.isArray(shares) ? shares : []
    const conversationId = routeParams.id

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
