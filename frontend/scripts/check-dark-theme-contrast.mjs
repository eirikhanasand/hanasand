import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roots = [
    path.join(frontendRoot, 'src/app/ti'),
    path.join(frontendRoot, 'src/app/dashboard/ti'),
]

const publicTi = readFileSync(path.join(frontendRoot, 'src/app/ti/pageClient.tsx'), 'utf8')
const workbench = readFileSync(path.join(frontendRoot, 'src/app/dashboard/ti/workbench/workbenchClient.tsx'), 'utf8')
const globals = readFileSync(path.join(frontendRoot, 'src/app/globals.css'), 'utf8')
const cookieSettings = readFileSync(path.join(frontendRoot, 'src/app/cookie-settings/pageClient.tsx'), 'utf8')
const darkwebIndex = readFileSync(path.join(frontendRoot, 'src/app/ti/darkweb/index/page.tsx'), 'utf8')
const publicHeader = readFileSync(path.join(frontendRoot, 'src/components/header/header.tsx'), 'utf8')
const statusClient = readFileSync(path.join(frontendRoot, 'src/app/status/pageClient.tsx'), 'utf8')
const subscriptionPage = readFileSync(path.join(frontendRoot, 'src/app/dashboard/subscription/page.tsx'), 'utf8')
const tiActivityPage = readFileSync(path.join(frontendRoot, 'src/app/dashboard/ti/activity/page.tsx'), 'utf8')
const tiAuditPage = readFileSync(path.join(frontendRoot, 'src/app/dashboard/ti/audit/page.tsx'), 'utf8')
const errorNotice = readFileSync(path.join(frontendRoot, 'src/components/error/errorNotice.tsx'), 'utf8')
const notesPage = readFileSync(path.join(frontendRoot, 'src/app/dashboard/notes/pageClient.tsx'), 'utf8')
const dbBackupPage = readFileSync(path.join(frontendRoot, 'src/app/dashboard/db/backups/backupPage.tsx'), 'utf8')
const tiDomainsPage = readFileSync(path.join(frontendRoot, 'src/app/dashboard/ti/domains/page.tsx'), 'utf8')
const trafficClient = readFileSync(path.join(frontendRoot, 'src/app/dashboard/traffic/pageClient.tsx'), 'utf8')
const logsClient = readFileSync(path.join(frontendRoot, 'src/app/dashboard/logs/pageClient.tsx'), 'utf8')
const loadTestingClient = readFileSync(path.join(frontendRoot, 'src/app/dashboard/load-testing/pageClient.tsx'), 'utf8')
const mailWorkspace = readFileSync(path.join(frontendRoot, 'src/components/mail/mailWorkspace.tsx'), 'utf8')
const mailWorkspaceParts = readFileSync(path.join(frontendRoot, 'src/components/mail/mailWorkspaceParts.tsx'), 'utf8')
const mailUtils = readFileSync(path.join(frontendRoot, 'src/components/mail/utils.tsx'), 'utf8')
const testContent = readFileSync(path.join(frontendRoot, 'src/components/test/testContent.tsx'), 'utf8')
const gitPlugin = readFileSync(path.join(frontendRoot, 'src/components/share/gitPlugin.tsx'), 'utf8')
const workspaceSearchPanel = readFileSync(path.join(frontendRoot, 'src/components/share/workspaceSearchPanel.tsx'), 'utf8')
const metadataPanel = readFileSync(path.join(frontendRoot, 'src/components/share/metadata.tsx'), 'utf8')
const referencePanel = readFileSync(path.join(frontendRoot, 'src/components/share/referencePanel.tsx'), 'utf8')
const terminalPanel = readFileSync(path.join(frontendRoot, 'src/components/share/terminal.tsx'), 'utf8')
const homeExposureQueueClient = readFileSync(path.join(frontendRoot, 'src/app/homeExposureQueueClient.tsx'), 'utf8')
const eirikPage = readFileSync(path.join(frontendRoot, 'src/app/eirik/page.tsx'), 'utf8')
const dwmAlertInbox = readFileSync(path.join(frontendRoot, 'src/app/dashboard/dwm/dwm-alert-inbox.tsx'), 'utf8')
const dwmWorkflowActions = readFileSync(path.join(frontendRoot, 'src/app/dashboard/dwm/dwm-workflow-actions.tsx'), 'utf8')
const recentScans = readFileSync(path.join(frontendRoot, 'src/components/test/recentScans.tsx'), 'utf8')
const pricingPage = readFileSync(path.join(frontendRoot, 'src/app/pricing/page.tsx'), 'utf8')
const testPageClient = readFileSync(path.join(frontendRoot, 'src/app/test/pageClient.tsx'), 'utf8')
const cronPageClient = readFileSync(path.join(frontendRoot, 'src/app/dashboard/system/cron/pageClient.tsx'), 'utf8')
const dashboardPage = readFileSync(path.join(frontendRoot, 'src/app/dashboard/page.tsx'), 'utf8')
const galleryPageClient = readFileSync(path.join(frontendRoot, 'src/app/gallery/pageClient.tsx'), 'utf8')
const trafficMap = readFileSync(path.join(frontendRoot, 'src/components/monitoring/traffic/trafficMap.tsx'), 'utf8')
const trafficMapPrimitives = readFileSync(path.join(frontendRoot, 'src/components/monitoring/traffic/liveMapPrimitives.tsx'), 'utf8')
const pwnedPage = readFileSync(path.join(frontendRoot, 'src/app/pwned/page.tsx'), 'utf8')
const pwnedPageClient = readFileSync(path.join(frontendRoot, 'src/app/pwned/pageClient.tsx'), 'utf8')
const pwnedSearch = readFileSync(path.join(frontendRoot, 'src/components/pwned/pwnedSearch.tsx'), 'utf8')
const loginPageClient = readFileSync(path.join(frontendRoot, 'src/app/login/pageClient.tsx'), 'utf8')
const registerPageClient = readFileSync(path.join(frontendRoot, 'src/app/register/pageClient.tsx'), 'utf8')
const publicFooter = readFileSync(path.join(frontendRoot, 'src/components/footer/footer.tsx'), 'utf8')
const previewFlow = readFileSync(path.join(frontendRoot, 'src/components/share/previewFlow.tsx'), 'utf8')
const contactPage = readFileSync(path.join(frontendRoot, 'src/components/contact/contact.tsx'), 'utf8')
const sharePublicClient = readFileSync(path.join(frontendRoot, 'src/app/s/[...id]/clientPage.tsx'), 'utf8')
const uploadPreview = readFileSync(path.join(frontendRoot, 'src/components/upload/preview.tsx'), 'utf8')
const profileCertificate = readFileSync(path.join(frontendRoot, 'src/components/profile/certificate.tsx'), 'utf8')
const profileCertificates = readFileSync(path.join(frontendRoot, 'src/components/profile/certificates.tsx'), 'utf8')
const lightSemanticSurface = /(bg-\[#(?:fff4d6|fff1f0|fffdf2|eef3ff|e9f8ef|f4fbf7)\])/
const semanticText = /text-\[#(?:3056d3|147a3b|8a5a00|b42318|9db4ff|8ca7ff|b8c8ff)\]/
const hoverOnly = /hover:(?:bg|text)-/
const violations = []

for (const root of roots) {
    for (const file of collectFiles(root)) {
        const relative = path.relative(frontendRoot, file)
        const lines = readFileSync(file, 'utf8').split(/\r?\n/)
        lines.forEach((line, index) => {
            if (hoverOnly.test(line)) return
            if (lightSemanticSurface.test(line) && semanticText.test(line) && !line.includes('dark:bg')) {
                violations.push(`${relative}:${index + 1} light semantic badge needs dark:bg and dark:text: ${line.trim()}`)
            }
        })
    }
}

const publicTiSyncingTone = 'border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
const workbenchSyncingTone = 'if (status === \'blocked\') return \'rounded-full bg-ui-warning/10 px-2 py-0.5 text-[11px] font-semibold text-ui-warning \''

if (!publicTi.includes(publicTiSyncingTone)) {
    violations.push('src/app/ti/pageClient.tsx decisionStepStatusClass fallback must render syncing/review states as amber, not red failure')
}

if (!workbench.includes(workbenchSyncingTone)) {
    violations.push('src/app/dashboard/ti/workbench/workbenchClient.tsx workflowStatusClass blocked tone must render as amber syncing, not red failure')
}

const paletteNames = [
    'ui-canvas',
    'ui-panel',
    'ui-raised',
    'ui-border',
    'ui-text',
    'ui-muted',
    'ui-primary',
    'ui-success',
    'ui-warning',
    'ui-danger',
]

for (const name of paletteNames) {
    if (!globals.includes(`--color-${name}: var(--${name});`)) {
        violations.push(`globals.css is missing Tailwind palette token --color-${name}`)
    }
    if (!globals.includes(`--${name}: #`)) {
        violations.push(`globals.css is missing concrete palette value --${name}`)
    }
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-danger',
]) {
    if (!cookieSettings.includes(required)) {
        violations.push(`cookie-settings page should use shared palette class ${required}`)
    }
}

const bannedCookiePageColor = /\b(?:bg|text|border)-\[#/g
if (bannedCookiePageColor.test(cookieSettings)) {
    violations.push('cookie-settings page should not use one-off hex Tailwind colors after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-warning',
]) {
    if (!darkwebIndex.includes(required)) {
        violations.push(`TI darkweb index page should use shared palette class ${required}`)
    }
}

const bannedDarkwebIndexColor = /\b(?:bg|text|border)-\[#/g
if (bannedDarkwebIndexColor.test(darkwebIndex)) {
    violations.push('TI darkweb index page should not use one-off hex Tailwind colors after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'bg-ui-text',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-canvas',
]) {
    if (!publicHeader.includes(required)) {
        violations.push(`public header should use shared palette class ${required}`)
    }
}

const bannedPublicHeaderColor = /\b(?:bg|text|border)-\[#|\b(?:bg|text|border)-(?:white|black)\//g
if (bannedPublicHeaderColor.test(publicHeader)) {
    violations.push('public header should not use one-off hex or white/black opacity Tailwind colors after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!statusClient.includes(required)) {
        violations.push(`public status page should use shared palette class ${required}`)
    }
}

const bannedStatusClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedStatusClientColor.test(statusClient)) {
    violations.push('public status page should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
]) {
    if (!subscriptionPage.includes(required)) {
        violations.push(`subscription dashboard page should use shared palette class ${required}`)
    }
}

const bannedSubscriptionPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedSubscriptionPageColor.test(subscriptionPage)) {
    violations.push('subscription dashboard page should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!tiActivityPage.includes(required)) {
        violations.push(`TI activity page should use shared palette class ${required}`)
    }
}

const bannedTiActivityPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedTiActivityPageColor.test(tiActivityPage)) {
    violations.push('TI activity page should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!tiAuditPage.includes(required)) {
        violations.push(`TI audit page should use shared palette class ${required}`)
    }
}

const bannedTiAuditPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedTiAuditPageColor.test(tiAuditPage)) {
    violations.push('TI audit page should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-danger',
    'border-ui-primary',
    'border-ui-success',
    'text-ui-danger',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-text',
]) {
    if (!errorNotice.includes(required)) {
        violations.push(`shared error notice should use shared palette class ${required}`)
    }
}

const bannedErrorNoticeColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedErrorNoticeColor.test(errorNotice)) {
    violations.push('shared error notice should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-danger',
]) {
    if (!notesPage.includes(required)) {
        violations.push(`notes dashboard page should use shared palette class ${required}`)
    }
}

const bannedNotesPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedNotesPageColor.test(notesPage)) {
    violations.push('notes dashboard page should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!dbBackupPage.includes(required)) {
        violations.push(`database backup page should use shared palette class ${required}`)
    }
}

const bannedDbBackupPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedDbBackupPageColor.test(dbBackupPage)) {
    violations.push('database backup page should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
]) {
    if (!tiDomainsPage.includes(required)) {
        violations.push(`TI domains page should use shared palette class ${required}`)
    }
}

const bannedTiDomainsPageColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedTiDomainsPageColor.test(tiDomainsPage)) {
    violations.push('TI domains page should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-danger',
]) {
    if (!trafficClient.includes(required)) {
        violations.push(`traffic dashboard client should use shared palette class ${required}`)
    }
}

const bannedTrafficClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedTrafficClientColor.test(trafficClient)) {
    violations.push('traffic dashboard client should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!logsClient.includes(required)) {
        violations.push(`logs dashboard client should use shared palette class ${required}`)
    }
}

const bannedLogsClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedLogsClientColor.test(logsClient)) {
    violations.push('logs dashboard client should not use one-off color Tailwind utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!loadTestingClient.includes(required)) {
        violations.push(`load testing dashboard client should use shared palette class ${required}`)
    }
}

const bannedLoadTestingClientColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g
if (bannedLoadTestingClientColor.test(loadTestingClient)) {
    violations.push('load testing dashboard client should not use one-off color Tailwind utilities after palette migration')
}

for (const [label, source] of [
    ['mail workspace', mailWorkspace],
    ['mail workspace parts', mailWorkspaceParts],
    ['mail utils', mailUtils],
]) {
    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
    ]) {
        if (!source.includes(required)) {
            violations.push(`${label} should use shared palette class ${required}`)
        }
    }

    const bannedMailColor = /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|bright|orange|emerald|amber|red)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|bright|orange|emerald|amber|red)\//g
    if (bannedMailColor.test(source)) {
        violations.push(`${label} should not use one-off mail color utilities after palette migration`)
    }
}

const mailCluster = [mailWorkspace, mailWorkspaceParts, mailUtils].join('\n')
for (const required of [
    'bg-ui-canvas',
    'bg-ui-primary',
    'text-ui-canvas',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!mailCluster.includes(required)) {
        violations.push(`mail workspace cluster should use shared palette class ${required}`)
    }
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
    'var(--ui-border)',
    'var(--ui-muted)',
    'var(--ui-primary)',
    'var(--ui-success)',
    'var(--ui-warning)',
    'var(--ui-danger)',
]) {
    if (!testContent.includes(required)) {
        violations.push(`test results content should use shared palette token ${required}`)
    }
}

const bannedTestContentColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g
if (bannedTestContentColor.test(testContent)) {
    violations.push('test results content should not use one-off Tailwind or chart hex colors after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-canvas',
]) {
    if (!gitPlugin.includes(required)) {
        violations.push(`share git plugin should use shared palette class ${required}`)
    }
}

const bannedGitPluginColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g
if (bannedGitPluginColor.test(gitPlugin)) {
    violations.push('share git plugin should not use one-off Git/share color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
]) {
    if (!workspaceSearchPanel.includes(required)) {
        violations.push(`workspace search panel should use shared palette class ${required}`)
    }
}

const bannedWorkspaceSearchPanelColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue)\//g
if (bannedWorkspaceSearchPanelColor.test(workspaceSearchPanel)) {
    violations.push('workspace search panel should not use one-off share color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-danger',
]) {
    if (!metadataPanel.includes(required)) {
        violations.push(`share metadata panel should use shared palette class ${required}`)
    }
}

const bannedMetadataPanelColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|stroke)-\[#|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|rgb|light|extralight|background)\//g
if (bannedMetadataPanelColor.test(metadataPanel)) {
    violations.push('share metadata panel should not use one-off share color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
]) {
    if (!referencePanel.includes(required)) {
        violations.push(`share reference panel should use shared palette class ${required}`)
    }
}

const bannedReferencePanelColor = /#[0-9a-fA-F]{3,6}|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\b|\b(?:bg|text|border|ring|outline|shadow)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|background)\//g
if (bannedReferencePanelColor.test(referencePanel)) {
    violations.push('share reference panel should not use one-off share color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!terminalPanel.includes(required)) {
        violations.push(`share terminal panel should use shared palette class ${required}`)
    }
}

const bannedTerminalPanelColor = /#[0-9a-fA-F]{3,6}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\b|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:dark|bright|white|black|red|orange|amber|yellow|green|emerald|blue|gray|light|extralight|background)\//g
if (bannedTerminalPanelColor.test(terminalPanel)) {
    violations.push('share terminal panel should not use one-off share color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!homeExposureQueueClient.includes(required)) {
        violations.push(`home latest activity panel should use shared palette class ${required}`)
    }
}

const bannedHomeExposureQueueColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue)\//g
if (bannedHomeExposureQueueColor.test(homeExposureQueueClient)) {
    violations.push('home latest activity panel should not use one-off public homepage color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-canvas',
]) {
    if (!eirikPage.includes(required)) {
        violations.push(`personal Eirik page should use shared palette class ${required}`)
    }
}

const bannedEirikPageColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
if (bannedEirikPageColor.test(eirikPage)) {
    violations.push('personal Eirik page should not use one-off public page color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!dwmAlertInbox.includes(required)) {
        violations.push(`DWM alert inbox should use shared palette class ${required}`)
    }
}

const bannedDwmAlertInboxColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
if (bannedDwmAlertInboxColor.test(dwmAlertInbox)) {
    violations.push('DWM alert inbox should not use one-off dark dashboard color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
    'text-ui-canvas',
]) {
    if (!dwmWorkflowActions.includes(required)) {
        violations.push(`DWM workflow actions should use shared palette class ${required}`)
    }
}

const bannedDwmWorkflowActionsColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
if (bannedDwmWorkflowActionsColor.test(dwmWorkflowActions)) {
    violations.push('DWM workflow actions should not use one-off dark dashboard color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
]) {
    if (!recentScans.includes(required)) {
        violations.push(`recent scans component should use shared palette class ${required}`)
    }
}

const bannedRecentScansColor = /#[0-9a-fA-F]{3,8}|\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
if (bannedRecentScansColor.test(recentScans)) {
    violations.push('recent scans component should not use one-off test dashboard color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-canvas',
]) {
    if (!pricingPage.includes(required)) {
        violations.push(`pricing page should use shared palette class ${required}`)
    }
}

const bannedPricingPageColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
if (bannedPricingPageColor.test(pricingPage)) {
    violations.push('pricing page should not use one-off public-page color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'stroke-ui-success',
    'stroke-ui-danger',
    'text-ui-canvas',
]) {
    if (!testPageClient.includes(required)) {
        violations.push(`test launcher page should use shared palette class ${required}`)
    }
}

const bannedTestPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
if (bannedTestPageClientColor.test(testPageClient)) {
    violations.push('test launcher page should not use one-off public test color utilities after palette migration')
}

for (const required of [
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-danger',
]) {
    if (!cronPageClient.includes(required)) {
        violations.push(`cron jobs dashboard page should use shared palette class ${required}`)
    }
}

const bannedCronPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g
if (bannedCronPageClientColor.test(cronPageClient)) {
    violations.push('cron jobs dashboard page should not use one-off dashboard color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-danger',
    'text-ui-canvas',
]) {
    if (!dashboardPage.includes(required)) {
        violations.push(`dashboard root page should use shared palette class ${required}`)
    }
}

const bannedDashboardPageColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g
if (bannedDashboardPageColor.test(dashboardPage)) {
    violations.push('dashboard root page should not use one-off dashboard color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
]) {
    if (!galleryPageClient.includes(required)) {
        violations.push(`gallery page should use shared palette class ${required}`)
    }
}

const bannedGalleryPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g
if (bannedGalleryPageClientColor.test(galleryPageClient)) {
    violations.push('gallery page should not use one-off public page color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-danger',
    'fill-ui-text',
    'fill-ui-warning',
    'stroke-ui-border',
]) {
    if (!trafficMap.includes(required) && !trafficMapPrimitives.includes(required)) {
        violations.push(`traffic map surface should use shared palette class ${required}`)
    }
}

const bannedTrafficMapSurfaceColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|fill|stroke)-\[#|\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
if (bannedTrafficMapSurfaceColor.test(`${trafficMap}\n${trafficMapPrimitives}`)) {
    violations.push('traffic map surface should not use one-off map color utilities after palette migration')
}

const pwnedRouteCluster = `${pwnedPage}\n${pwnedPageClient}\n${pwnedSearch}`
for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-danger',
]) {
    if (!pwnedRouteCluster.includes(required)) {
        violations.push(`pwned password check surface should use shared palette class ${required}`)
    }
}

const bannedPwnedSurfaceColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
if (bannedPwnedSurfaceColor.test(pwnedRouteCluster)) {
    violations.push('pwned password check surface should not use one-off public page color utilities after palette migration')
}

for (const rawSecretPattern of [
    /body:\s*JSON\.stringify\(\{\s*password\s*\}\)/,
    /ws\.send\(JSON\.stringify\(\{\s*password\s*\}\)\)/,
]) {
    if (rawSecretPattern.test(pwnedRouteCluster)) {
        violations.push('pwned password check should not send the raw password from the browser')
    }
}

for (const requiredPrivacyToken of [
    'checkedPrefix',
    'without sending the password or full hash to Hanasand',
]) {
    if (!pwnedRouteCluster.includes(requiredPrivacyToken)) {
        violations.push(`pwned password check should disclose hash-prefix privacy behavior: ${requiredPrivacyToken}`)
    }
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-warning',
]) {
    if (!loginPageClient.includes(required)) {
        violations.push(`login page should use shared palette class ${required}`)
    }
}

const bannedLoginPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
if (bannedLoginPageClientColor.test(loginPageClient)) {
    violations.push('login page should not use one-off public page color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-warning',
    'text-ui-success',
    'text-ui-danger',
]) {
    if (!registerPageClient.includes(required)) {
        violations.push(`register page should use shared palette class ${required}`)
    }
}

const bannedRegisterPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
if (bannedRegisterPageClientColor.test(registerPageClient)) {
    violations.push('register page should not use one-off public page color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
]) {
    if (!publicFooter.includes(required)) {
        violations.push(`public footer should use shared palette class ${required}`)
    }
}

const bannedPublicFooterColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
if (bannedPublicFooterColor.test(publicFooter)) {
    violations.push('public footer should not use one-off public page color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-canvas',
]) {
    if (!previewFlow.includes(required)) {
        violations.push(`preview flow should use shared palette class ${required}`)
    }
}

const bannedPreviewFlowColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
if (bannedPreviewFlowColor.test(previewFlow)) {
    violations.push('preview flow should not use one-off share toolbar color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-canvas',
]) {
    if (!uploadPreview.includes(required)) {
        violations.push(`upload preview should use shared palette class ${required}`)
    }
}

const bannedUploadPreviewColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
if (bannedUploadPreviewColor.test(uploadPreview)) {
    violations.push('upload preview should not use one-off upload form color utilities after palette migration')
}

for (const [label, source] of [
    ['profile certificate card', profileCertificate],
    ['profile certificates panel', profileCertificates],
]) {
    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
    ]) {
        if (!source.includes(required)) {
            violations.push(`${label} should use shared palette class ${required}`)
        }
    }
}

const profileCertificatesCluster = [profileCertificate, profileCertificates].join('\n')
for (const required of [
    'bg-ui-canvas',
    'text-ui-canvas',
    'text-ui-danger',
]) {
    if (!profileCertificatesCluster.includes(required)) {
        violations.push(`profile certificate surface should use shared palette class ${required}`)
    }
}

const bannedProfileCertificatesColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline|shadow|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
if (bannedProfileCertificatesColor.test(profileCertificatesCluster)) {
    violations.push('profile certificate surface should not use one-off profile color utilities after palette migration')
}

for (const required of [
    'bg-ui-canvas',
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-canvas',
]) {
    if (!contactPage.includes(required)) {
        violations.push(`contact page should use shared palette class ${required}`)
    }
}

const bannedContactPageColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
if (bannedContactPageColor.test(contactPage)) {
    violations.push('contact page should not use one-off public page color utilities after palette migration')
}

for (const required of [
    'bg-ui-panel',
    'bg-ui-raised',
    'border-ui-border',
    'text-ui-text',
    'text-ui-muted',
    'text-ui-primary',
    'text-ui-success',
    'text-ui-warning',
    'text-ui-canvas',
]) {
    if (!sharePublicClient.includes(required)) {
        violations.push(`public share client should use shared palette class ${required}`)
    }
}

const bannedSharePublicClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g
if (bannedSharePublicClientColor.test(sharePublicClient)) {
    violations.push('public share client should not use one-off share chrome color utilities after palette migration')
}

const themes = extractUiThemes(globals)
for (const [themeName, theme] of Object.entries(themes)) {
    for (const [foreground, background, minimum] of [
        ['ui-text', 'ui-canvas', 7],
        ['ui-text', 'ui-panel', 7],
        ['ui-text', 'ui-raised', 7],
        ['ui-muted', 'ui-canvas', 4.5],
        ['ui-muted', 'ui-panel', 4.5],
        ['ui-muted', 'ui-raised', 4.5],
        ['ui-primary', 'ui-panel', 4.5],
        ['ui-success', 'ui-panel', 4.5],
        ['ui-warning', 'ui-panel', 4.5],
        ['ui-danger', 'ui-panel', 4.5],
    ]) {
        const ratio = contrastRatio(theme[foreground], theme[background])
        if (ratio < minimum) {
            violations.push(`${themeName} palette contrast ${foreground} on ${background} is ${ratio.toFixed(2)}, expected >= ${minimum}`)
        }
    }
}

if (violations.length) {
    console.error('[dark-theme-contrast] light semantic badges need dark-mode surfaces')
    console.error(violations.join('\n'))
    process.exit(1)
}

console.log('[dark-theme-contrast] semantic badges include dark-mode surfaces')

function collectFiles(root) {
    const files = []
    for (const entry of readdirSync(root)) {
        const absolute = path.join(root, entry)
        const stat = statSync(absolute)
        if (stat.isDirectory()) {
            files.push(...collectFiles(absolute))
            continue
        }
        if (/\.(ts|tsx)$/.test(entry)) files.push(absolute)
    }
    return files.sort((a, b) => a.localeCompare(b))
}

function extractUiThemes(source) {
    return {
        dark: extractThemeBlock(source, '.dark'),
        light: extractThemeBlock(source, '.light'),
    }
}

function extractThemeBlock(source, selector) {
    const start = source.indexOf(`${selector} {`)
    if (start === -1) throw new Error(`Missing ${selector} theme block`)
    const end = source.indexOf('\n}', start)
    const block = source.slice(start, end)
    const values = {}
    for (const name of paletteNames) {
        const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
        if (!match) throw new Error(`Missing --${name} in ${selector}`)
        values[name] = match[1]
    }
    return values
}

function contrastRatio(first, second) {
    const a = relativeLuminance(hexToRgb(first))
    const b = relativeLuminance(hexToRgb(second))
    const lighter = Math.max(a, b)
    const darker = Math.min(a, b)
    return (lighter + 0.05) / (darker + 0.05)
}

function hexToRgb(hex) {
    const normalized = hex.replace('#', '')
    return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16),
    ]
}

function relativeLuminance(rgb) {
    const [r, g, b] = rgb.map((channel) => {
        const value = channel / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
