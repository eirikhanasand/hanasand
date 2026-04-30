const exactReservedUsernames = [
    'abuse',
    'admin',
    'administrator',
    'billing',
    'bookkeeper',
    'ceo',
    'cfo',
    'chairman',
    'compliance',
    'contact',
    'controller',
    'coo',
    'cto',
    'cdc',
    'director',
    'eirikhanasand',
    'executive',
    'facebook',
    'finance',
    'google',
    'hanasand',
    'help',
    'hr',
    'legal',
    'management',
    'manager',
    'meta',
    'microsoft',
    'noreply',
    'owner',
    'paypal',
    'postmaster',
    'president',
    'root',
    'security',
    'soc',
    'spam',
    'staff',
    'support',
    'sysadmin',
    'treasurer',
    'trust',
    'twitter',
    'x',
]

const reservedPatterns = [
    /(?:^|[-_.])(admin|administrator|root|sysadmin)(?:$|[-_.])/,
    /(?:^|[-_.])(security|soc|abuse|spam|postmaster|noreply|trust|compliance)(?:$|[-_.])/,
    /(?:^|[-_.])(ceo|cfo|coo|cto|director|manager|management|finance|billing|treasurer|controller)(?:$|[-_.])/,
    /(?:^|[-_.])(google|facebook|meta|microsoft|paypal|twitter)(?:$|[-_.])/,
]

export type ReservedUsernameCategory = {
    title: string
    description: string
    examples: string[]
}

export const reservedUsernameCategories: ReservedUsernameCategory[] = [
    {
        title: 'System and infrastructure',
        description: 'Operational names that should only be controlled by Hanasand services.',
        examples: ['admin', 'administrator', 'root', 'sysadmin', 'hanasand', 'noreply'],
    },
    {
        title: 'Mail and abuse handling',
        description: 'Addresses used for mail delivery, abuse reporting, trust, and security workflows.',
        examples: ['postmaster', 'abuse', 'spam', 'security', 'soc', 'trust', 'compliance'],
    },
    {
        title: 'Management and financial authority',
        description: 'Names that could imply official authority, finance ownership, or executive control.',
        examples: ['ceo', 'cfo', 'coo', 'cto', 'director', 'management', 'finance', 'billing'],
    },
    {
        title: 'Brand impersonation',
        description: 'Names that imitate major outside companies or platforms.',
        examples: ['google', 'facebook', 'meta', 'microsoft', 'paypal', 'twitter'],
    },
]

export const reservedUsernames = [...new Set(exactReservedUsernames)].sort()

export function normalizeUsername(value: string) {
    return value.trim().toLowerCase()
}

export function isReservedUsername(value: string) {
    const username = normalizeUsername(value)
    if (!username) {
        return false
    }

    return reservedUsernames.includes(username) || reservedPatterns.some(pattern => pattern.test(username))
}

export function getReservedUsernameReason(value: string) {
    const username = normalizeUsername(value)
    if (!username) {
        return null
    }

    if (reservedUsernames.includes(username)) {
        return 'This username is reserved for Hanasand system, trust, management, or anti-impersonation use.'
    }

    if (reservedPatterns.some(pattern => pattern.test(username))) {
        return 'This username looks like a protected system, security, management, finance, or impersonation name.'
    }

    return null
}
