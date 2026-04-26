export type RouteShortcut = {
    title: string
    path: string
    summary: string
    category: string
}

export type AppSettings = {
    siteBaseUrl: string
    apiBaseUrl: string
    cdnBaseUrl: string
    authToken: string
    userId: string
    codexUrl: string
    codexApiPath: string
    vpnUrlScheme: string
    remoteDesktopHost: string
    remoteDesktopUser: string
    vncHost: string
    serverBaseUrl: string
    serverStartPath: string
    serverStopPath: string
    serverLogsPath: string
}

export type MailAddress = {
    email: string
    name?: string
}

export type MailMessageSummary = {
    id: string
    subject: string
    preview: string
    receivedAt: string
    from: MailAddress[]
    to: MailAddress[]
    hasAttachment: boolean
    isRead: boolean
    isFlagged: boolean
}

export type MailMessage = MailMessageSummary & {
    textBody: string
    htmlBody: string
}

export type MailboxItem = {
    id: string
    name: string
    role?: string
    unreadEmails?: number
}

export type MailOverview = {
    mailboxUser: string
    mailboxAddress: string
    accessibleAccounts: Array<{ id: string; name: string; address: string }>
    mailboxes: MailboxItem[]
    selectedMailboxId: string | null
    messages: MailMessageSummary[]
    selectedMessage: MailMessage | null
}

export type ScannerPage = {
    id: string
    uri: string
    createdAt: number
}

export type SwipeDecision = 'keep' | 'discard'

export type ImageReviewAsset = {
    id: string
    uri: string
    filename?: string
    width: number
    height: number
    creationTime?: number
}

export type SavedMailboxConnection = {
    id: string
    label: string
    email: string
    imapHost: string
    smtpHost: string
}

export type AiChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: number
    error?: boolean
    pending?: boolean
}

export type AuthenticatorEntry = {
    id: string
    label: string
    issuer?: string
    account?: string
    secret: string
    digits: number
    period: number
}

export type GptClient = {
    name: string
    model?: {
        tps?: number
        status?: string
    }
}

export type ShareSummary = {
    id: string
    alias?: string | null
    path?: string | null
    name?: string | null
    timestamp?: string
    content?: string
    locked?: boolean
}
