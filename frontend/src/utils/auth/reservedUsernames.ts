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

export const reservedUsernames = [
    'abuse',
    'admin',
    'administrator',
    'billing',
    'bookkeeper',
    'cdc',
    'ceo',
    'cfo',
    'chairman',
    'compliance',
    'contact',
    'controller',
    'coo',
    'cto',
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
].sort()
