import {
    Crown, ShieldCheck, Users, UserCog, UserRound, KeyRound, LockKeyhole, Contact, Fingerprint, Building2,
    Server, Cloud, Network, Container, Database, HardDrive, Cpu, MemoryStick, Router, Globe,
    Code2, Terminal, GitBranch, GitPullRequest, Bug, FlaskConical, Package, Rocket, Workflow, Braces,
    Shield, Eye, Scan, Search, Radar, Siren, ShieldAlert, FileKey, FileSearch, BadgeCheck,
    Headset, FileText, Pencil, BookOpen, Newspaper, CreditCard, Wallet, ChartNoAxesCombined, Activity, Wrench,
    type LucideIcon,
} from 'lucide-react'

type Preset = { id: string, label: string, category: string, Icon: LucideIcon }
const group = (category: string, entries: Array<[string, string, LucideIcon]>): Preset[] => entries.map(([id, label, Icon]) => ({ id, label, Icon, category }))
export const roleIcons: Preset[] = [
    ...group('People & access', [
        ['crown', 'Administrator', Crown], ['shield-check', 'Access manager', ShieldCheck], ['users', 'Team', Users], ['user-cog', 'User manager', UserCog], ['user-round', 'Member', UserRound],
        ['key-round', 'API access', KeyRound], ['lock-keyhole', 'Private access', LockKeyhole], ['contact', 'Identity', Contact], ['fingerprint', 'Authentication', Fingerprint], ['building-2', 'Organization', Building2],
    ]),
    ...group('Infrastructure', [
        ['server', 'System administrator', Server], ['cloud', 'Cloud', Cloud], ['network', 'Networking', Network], ['container', 'Containers', Container], ['database', 'Database', Database],
        ['hard-drive', 'Storage', HardDrive], ['cpu', 'Compute', Cpu], ['memory-stick', 'Memory', MemoryStick], ['router', 'Gateway', Router], ['globe', 'Domains', Globe],
    ]),
    ...group('Engineering', [
        ['code-2', 'Developer', Code2], ['terminal', 'Console', Terminal], ['git-branch', 'Repository', GitBranch], ['git-pull-request', 'Code reviewer', GitPullRequest], ['bug', 'Debugging', Bug],
        ['flask-conical', 'Testing', FlaskConical], ['package', 'Packages', Package], ['rocket', 'Deployment', Rocket], ['workflow', 'Automation', Workflow], ['braces', 'Integration', Braces],
    ]),
    ...group('Security', [
        ['shield', 'Security', Shield], ['eye', 'Read only', Eye], ['scan', 'Scanner', Scan], ['search', 'Investigator', Search], ['radar', 'Threat intelligence', Radar],
        ['siren', 'Incident response', Siren], ['shield-alert', 'Security alerts', ShieldAlert], ['file-key', 'Secrets', FileKey], ['file-search', 'Auditor', FileSearch], ['badge-check', 'Approver', BadgeCheck],
    ]),
    ...group('Operations', [
        ['headset', 'Support', Headset], ['file-text', 'Content', FileText], ['pencil', 'Editor', Pencil], ['book-open', 'Documentation', BookOpen], ['newspaper', 'Publisher', Newspaper],
        ['credit-card', 'Billing', CreditCard], ['wallet', 'Finance', Wallet], ['chart-no-axes-combined', 'Analyst', ChartNoAxesCombined], ['activity', 'Monitoring', Activity], ['wrench', 'Maintainer', Wrench],
    ]),
]

export function roleIconId(role: { id?: string, name: string, icon?: string | null }) {
    if (role.icon && roleIcons.some(preset => preset.id === role.icon)) return role.icon
    const builtIn: Record<string, string> = { administrator: 'crown', system_admin: 'server', user_admin: 'user-cog', content_admin: 'pencil', users: 'users', support: 'headset' }
    if (role.id && builtIn[role.id]) return builtIn[role.id]
    const name = role.name.toLowerCase()
    const matches: Array<[RegExp, string]> = [
        [/admin|owner/, 'crown'], [/support|help/, 'headset'], [/secur/, 'shield'], [/audit/, 'file-search'], [/review/, 'git-pull-request'],
        [/develop|engineer/, 'code-2'], [/billing/, 'credit-card'], [/financ/, 'wallet'], [/analyst|analysis/, 'chart-no-axes-combined'], [/monitor/, 'activity'],
        [/network/, 'network'], [/database|\bdba\b/, 'database'], [/cloud/, 'cloud'], [/deploy/, 'rocket'], [/automat/, 'workflow'], [/content|edit/, 'pencil'], [/read|view|guest/, 'eye'], [/team|user/, 'users'],
    ]
    return matches.find(([pattern]) => pattern.test(name))?.[1] || 'user-round'
}

export function RoleIcon({ role, className = 'h-5 w-5' }: { role: { id?: string, name: string, icon?: string | null }, className?: string }) {
    const id = roleIconId(role)
    const Icon = roleIcons.find(preset => preset.id === id)!.Icon
    return <Icon className={className} aria-hidden='true' data-role-icon={id} />
}
