export const WORKSPACE_COOKIE = 'hanasand_workspace'
export type Workspace = { userId: string, organizationId: string, name: string }
export const organizationKeys = ['org', 'organizationId', 'orgId'] as const
export function readWorkspace(value: string | undefined, userId: string): Workspace | null {
    try {
        const parsed = JSON.parse(value || 'null')
        return userId && parsed?.userId === userId && typeof parsed.organizationId === 'string' && typeof parsed.name === 'string' ? parsed : null
    } catch { return null }
}
export function organizationFromParams(params: Pick<URLSearchParams, 'get'>) {
    return organizationKeys.map(key => params.get(key)?.trim()).find(Boolean) || ''
}
export function cleanWorkspaceUrl(value: string) {
    const url = new URL(value, 'https://hanasand.com')
    for (const key of organizationKeys) url.searchParams.delete(key)
    url.searchParams.delete('tenantId')
    return `${url.pathname}${url.search}${url.hash}`
}
export function workspaceShareUrl(value: string, organizationId?: string) {
    const url = new URL(cleanWorkspaceUrl(value), new URL(value, 'https://hanasand.com').origin)
    const target = organizationFromParams(new URL(value, 'https://hanasand.com').searchParams) || organizationId
    if (target) url.searchParams.set('org', target)
    return url.toString()
}
