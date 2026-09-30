export const HANASAND_ORGANIZATION_ID = '3e735e7b-4d7f-444d-9806-231fa26cfcec'

export type InternalPageOrganization = {
    id: string
    role?: string
    lifecycleStatus?: string
}

export function canViewHanasandInternalPages(organizations: InternalPageOrganization[]) {
    return organizations.some(organization => organization.id === HANASAND_ORGANIZATION_ID
        && organization.lifecycleStatus === 'active'
        && ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'].includes(organization.role?.toLowerCase() || ''))
}
