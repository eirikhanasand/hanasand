import { cookies } from 'next/headers'
import AIPageClient from '../pageClient'
import { getUserShares } from '@/utils/share/getUserShares'
import { getAiWorkspace } from '@/utils/ai/getWorkspace'

export default async function AIWindowPage() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    const [shares, workspace] = await Promise.all([
        id && token ? getUserShares({ id, token }) : Promise.resolve([]),
        getAiWorkspace({ id, token }),
    ])
    const initialShares = Array.isArray(shares) ? shares : []

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
            mode='workspace'
        />
    )
}
