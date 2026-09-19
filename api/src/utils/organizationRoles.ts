export type OrganizationRole = 'owner' | 'admin' | 'editor' | 'reader' | 'member' | 'viewer'

// Legacy roles remain readable during rolling upgrades; neither grants write access.
export function normalizeOrganizationRole(role: OrganizationRole): OrganizationRole {
    return role === 'member' || role === 'viewer' ? 'reader' : role
}

export function roleCanManageOrganization(role: string | null | undefined) {
    return role === 'owner' || role === 'admin'
}

export function roleCanEditOrganization(role: string | null | undefined) {
    return roleCanManageOrganization(role) || role === 'editor'
}
