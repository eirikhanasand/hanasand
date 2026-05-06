import PendingDeletionPage from './pageClient'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    return <PendingDeletionPage
        id={(Array.isArray(params.id) ? params.id[0] : params.id) || ''}
        restoreToken={(Array.isArray(params.restoreToken) ? params.restoreToken[0] : params.restoreToken) || ''}
        deletionScheduledAt={(Array.isArray(params.deletionScheduledAt) ? params.deletionScheduledAt[0] : params.deletionScheduledAt) || ''}
    />
}
