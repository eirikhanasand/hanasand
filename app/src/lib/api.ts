import type { AiFileSummary, AiRunDetails, AiToolUseSummary, AppSettings, DashboardRole, DashboardUser, DashboardUserRoleAssignment, DesktopAgentStatus, GptClient, MailAddress, MailboxItem, MailMessage, MailMessageSummary, MailOverview, MailSendResult, Note, ShareSummary, ShareTreeItem } from '../types'

function headers(settings: AppSettings) {
    return {
        'Content-Type': 'application/json',
        Authorization: settings.authToken ? `Bearer ${settings.authToken}` : '',
        id: settings.userId || '',
    }
}

function requireAppAuth(settings: AppSettings, purpose: string) {
    if (!settings.apiBaseUrl || !settings.authToken || !settings.userId) {
        throw new Error(`Configure API URL, auth token, and user id to ${purpose}.`)
    }
}

function requireCdnAuth(settings: AppSettings, purpose: string) {
    if (!settings.cdnBaseUrl || !settings.authToken || !settings.userId) {
        throw new Error(`Configure CDN API URL, auth token, and user id to ${purpose}.`)
    }
}

function baseUrl(value: string) {
    return value.trim().replace(/\/+$/, '')
}

function pathPart(value: string) {
    return value.trim().replace(/^\/+/, '')
}

function joinUrl(base: string, path: string) {
    const cleanBase = baseUrl(base)
    const cleanPath = pathPart(path)
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase
}

function desktopAgentBases(settings: AppSettings) {
    const primary = settings.desktopAgentBaseUrl.trim()
    if (!primary) return []
    const fallback = primary.replace('127.0.0.1', 'localhost')
    return fallback === primary ? [primary] : [primary, fallback]
}

async function fetchDesktopAgentPath(settings: AppSettings, path: string, init?: RequestInit) {
    const bases = desktopAgentBases(settings)
    if (!bases.length) {
        throw new Error('Desktop agent URL is not configured.')
    }

    let lastError: unknown
    for (const base of bases) {
        try {
            return await fetch(joinUrl(base, path), init)
        } catch (error) {
            lastError = error
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Desktop agent is unreachable.')
}

function segment(value: string) {
    return encodeURIComponent(value)
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanValue(value: unknown) {
    return typeof value === 'boolean' ? value : undefined
}

function asRecord(value: unknown) {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function normalizeToolUses(value: unknown): AiToolUseSummary[] | undefined {
    if (!Array.isArray(value)) return undefined
    const tools = value.map(item => {
        const entry = asRecord(item)
        const name = stringValue(entry.name) || stringValue(entry.tool) || stringValue(entry.type)
        if (!name) return null
        return {
            name,
            summary: stringValue(entry.summary) || stringValue(entry.result) || stringValue(entry.input) || undefined,
            durationMs: numberValue(entry.durationMs) ?? numberValue(entry.duration_ms),
        }
    }).filter(Boolean) as AiToolUseSummary[]
    return tools.length ? tools : undefined
}

function normalizeFileSummaries(value: unknown): AiFileSummary[] | undefined {
    if (!Array.isArray(value)) return undefined
    const files = value.map(item => {
        const entry = asRecord(item)
        const path = stringValue(entry.path) || stringValue(entry.file) || stringValue(entry.name)
        if (!path) return null
        return {
            path,
            summary: stringValue(entry.summary) || stringValue(entry.description) || undefined,
            additions: numberValue(entry.additions),
            deletions: numberValue(entry.deletions),
        }
    }).filter(Boolean) as AiFileSummary[]
    return files.length ? files : undefined
}

function normalizeShare(value: unknown): ShareSummary | null {
    const entry = asRecord(value)
    const id = stringValue(entry.id)
    if (!id) return null
    return {
        id,
        alias: stringValue(entry.alias) || null,
        path: stringValue(entry.path) || null,
        name: stringValue(entry.name) || null,
        timestamp: stringValue(entry.timestamp) || undefined,
        content: stringValue(entry.content) || undefined,
        locked: typeof entry.locked === 'boolean' ? entry.locked : undefined,
        parent: stringValue(entry.parent) || null,
        type: stringValue(entry.type) || null,
    }
}

function normalizeShareTree(value: unknown): ShareTreeItem[] {
    if (!Array.isArray(value)) return []
    return value.map(item => {
        const entry = asRecord(item)
        const id = stringValue(entry.id)
        const name = stringValue(entry.name) || stringValue(entry.path) || id
        const rawType = stringValue(entry.type)
        if (!id || !name) return null
        return {
            id,
            name,
            alias: stringValue(entry.alias) || null,
            parent: stringValue(entry.parent) || null,
            type: rawType === 'folder' ? 'folder' : 'file',
            children: normalizeShareTree(entry.children),
        }
    }).filter(Boolean) as ShareTreeItem[]
}

function normalizeMailAddresses(value: unknown): MailAddress[] {
    if (!Array.isArray(value)) return []
    return value.map(item => {
        const entry = asRecord(item)
        const email = stringValue(entry.email)
        if (!email) return null
        return { email, name: stringValue(entry.name) || undefined }
    }).filter(Boolean) as MailAddress[]
}

function normalizeMailbox(value: unknown): MailboxItem | null {
    const entry = asRecord(value)
    const id = stringValue(entry.id)
    const name = stringValue(entry.name)
    if (!id || !name) return null
    return {
        id,
        name,
        role: stringValue(entry.role) || undefined,
        unreadEmails: numberValue(entry.unreadEmails) ?? numberValue(entry.unread_emails),
    }
}

function normalizeMailSummary(value: unknown): MailMessageSummary | null {
    const entry = asRecord(value)
    const id = stringValue(entry.id)
    if (!id) return null
    return {
        id,
        subject: stringValue(entry.subject) || '(no subject)',
        preview: stringValue(entry.preview),
        receivedAt: stringValue(entry.receivedAt) || stringValue(entry.received_at),
        from: normalizeMailAddresses(entry.from),
        to: normalizeMailAddresses(entry.to),
        hasAttachment: booleanValue(entry.hasAttachment) ?? booleanValue(entry.has_attachment) ?? false,
        isRead: booleanValue(entry.isRead) ?? booleanValue(entry.is_read) ?? false,
        isFlagged: booleanValue(entry.isFlagged) ?? booleanValue(entry.is_flagged) ?? false,
    }
}

function normalizeMailMessage(value: unknown): MailMessage | null {
    const summary = normalizeMailSummary(value)
    if (!summary) return null
    const entry = asRecord(value)
    return {
        ...summary,
        textBody: stringValue(entry.textBody) || stringValue(entry.text_body) || summary.preview,
        htmlBody: stringValue(entry.htmlBody) || stringValue(entry.html_body),
    }
}

function normalizeMailOverview(value: unknown): MailOverview {
    const entry = asRecord(value)
    const messages = Array.isArray(entry.messages)
        ? entry.messages.map(normalizeMailSummary).filter(Boolean) as MailMessageSummary[]
        : []
    return {
        mailboxUser: stringValue(entry.mailboxUser) || stringValue(entry.mailbox_user),
        mailboxAddress: stringValue(entry.mailboxAddress) || stringValue(entry.mailbox_address) || 'Not connected',
        accessibleAccounts: Array.isArray(entry.accessibleAccounts)
            ? entry.accessibleAccounts.map(item => {
                const account = asRecord(item)
                const id = stringValue(account.id)
                if (!id) return null
                return {
                    id,
                    name: stringValue(account.name) || id,
                    address: stringValue(account.address),
                }
            }).filter(Boolean) as Array<{ id: string; name: string; address: string }>
            : [],
        mailboxes: Array.isArray(entry.mailboxes) ? entry.mailboxes.map(normalizeMailbox).filter(Boolean) as MailboxItem[] : [],
        selectedMailboxId: stringValue(entry.selectedMailboxId) || stringValue(entry.selected_mailbox_id) || null,
        messages,
        selectedMessage: normalizeMailMessage(entry.selectedMessage || entry.selected_message),
    }
}

function normalizeMailSendResult(value: unknown): MailSendResult | null {
    const entry = asRecord(value)
    if (!Object.keys(entry).length) return null
    return {
        ok: booleanValue(entry.ok) ?? false,
        mailboxUser: stringValue(entry.mailboxUser) || stringValue(entry.mailbox_user),
        sentMailboxId: stringValue(entry.sentMailboxId) || stringValue(entry.sent_mailbox_id) || null,
        sentMessageId: stringValue(entry.sentMessageId) || stringValue(entry.sent_message_id) || null,
    }
}

function normalizeGptClient(value: unknown): GptClient | null {
    const entry = asRecord(value)
    const name = stringValue(entry.name)
    if (!name) return null
    const model = asRecord(entry.model)
    return {
        name,
        model: {
            tps: numberValue(model.tps),
            status: stringValue(model.status) || undefined,
        },
    }
}

function normalizeTrafficDomain(value: unknown): { name: string; tps?: number } | null {
    const entry = asRecord(value)
    const name = stringValue(entry.name) || stringValue(entry.domain)
    if (!name) return null
    return { name, tps: numberValue(entry.tps) }
}

function normalizeDesktopStatus(value: unknown): DesktopAgentStatus {
    const entry = asRecord(value)
    return {
        ok: booleanValue(entry.ok) ?? false,
        agent: stringValue(entry.agent) || undefined,
        hostname: stringValue(entry.hostname) || undefined,
        platform: stringValue(entry.platform) || undefined,
        user: stringValue(entry.user) || undefined,
        cwd: stringValue(entry.cwd) || undefined,
        uptimeSeconds: numberValue(entry.uptimeSeconds) ?? numberValue(entry.uptime_seconds),
        timestamp: stringValue(entry.timestamp) || undefined,
        message: stringValue(entry.message) || undefined,
        screenCaptureAllowed: booleanValue(entry.screenCaptureAllowed) ?? booleanValue(entry.screen_capture_allowed),
        accessibilityAllowed: booleanValue(entry.accessibilityAllowed) ?? booleanValue(entry.accessibility_allowed),
    }
}

function normalizeNote(value: unknown): Note | null {
    const entry = asRecord(value)
    const id = stringValue(entry.id)
    if (!id) return null
    return {
        id,
        title: stringValue(entry.title),
        content: stringValue(entry.content),
        source: stringValue(entry.source) || 'app',
        owner_id: stringValue(entry.owner_id) || stringValue(entry.ownerId),
        created_at: stringValue(entry.created_at) || stringValue(entry.createdAt),
        updated_at: stringValue(entry.updated_at) || stringValue(entry.updatedAt),
    }
}

function normalizeRole(value: unknown): DashboardRole | null {
    const entry = asRecord(value)
    const id = stringValue(entry.id) || stringValue(entry.role_id) || stringValue(entry.name)
    if (!id) return null
    return {
        id,
        name: stringValue(entry.name) || id,
        description: stringValue(entry.description) || undefined,
        priority: numberValue(entry.priority),
    }
}

function normalizeUserRoleAssignment(value: unknown): DashboardUserRoleAssignment | null {
    const entry = asRecord(value)
    const roleId = stringValue(entry.role_id) || stringValue(entry.roleId) || stringValue(entry.id) || stringValue(entry.name)
    if (!roleId) return null
    return {
        id: stringValue(entry.id) || roleId,
        roleId,
        name: stringValue(entry.name) || roleId,
        priority: numberValue(entry.priority),
    }
}

function normalizeDashboardUser(value: unknown): DashboardUser | null {
    const entry = asRecord(value)
    const id = stringValue(entry.id)
    if (!id) return null
    const roles = Array.isArray(entry.roles) ? entry.roles.map(normalizeRole).filter(Boolean) as DashboardRole[] : undefined
    return {
        id,
        name: stringValue(entry.name) || stringValue(entry.displayName) || stringValue(entry.display_name) || id,
        active: booleanValue(entry.active),
        role: stringValue(entry.role) || stringValue(entry.role_id) || roles?.[0]?.name,
        roles,
        highestRolePriority: numberValue(entry.highestRolePriority) ?? numberValue(entry.highest_role_priority),
    }
}

async function readJsonObject(response: Response, fallback: unknown) {
    return response.json().catch(() => fallback)
}

export async function fetchMailOverview(settings: AppSettings, mailboxId?: string | null, messageId?: string | null, mailboxUser?: string | null) {
    requireAppAuth(settings, 'load mail')

    const search = new URLSearchParams()
    if (mailboxUser) search.set('mailboxUser', mailboxUser)
    if (mailboxId) search.set('mailboxId', mailboxId)
    if (messageId) search.set('messageId', messageId)

    const response = await fetch(`${joinUrl(settings.apiBaseUrl, 'mail/overview')}?${search.toString()}`, {
        headers: headers(settings),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to load mail overview.')
    }

    const body = await response.json().catch(() => null)
    if (!body || typeof body !== 'object') {
        throw new Error('Mail overview returned an unexpected response.')
    }

    return normalizeMailOverview(body)
}

export async function postMailAction(settings: AppSettings, messageId: string, action: string, targetMailboxId?: string) {
    requireAppAuth(settings, 'update mail')

    const response = await fetch(joinUrl(settings.apiBaseUrl, `mail/message/${segment(messageId)}/action`), {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ action, targetMailboxId }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to update message.')
    }
}

export async function createMailbox(settings: AppSettings, name: string) {
    requireAppAuth(settings, 'create mailbox folders')

    const response = await fetch(joinUrl(settings.apiBaseUrl, 'mail/mailboxes'), {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ name }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to create mailbox.')
    }
}

export async function sendMailMessage(settings: AppSettings, body: {
    mailboxUser?: string
    to: string
    cc?: string
    bcc?: string
    subject: string
    textBody: string
}) {
    requireAppAuth(settings, 'send mail')

    const response = await fetch(joinUrl(settings.apiBaseUrl, 'mail/send'), {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify(body),
    })

    const responseBody = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(String((responseBody as { error?: string } | null)?.error || 'Unable to send mail.'))
    }

    return normalizeMailSendResult(responseBody)
}

export async function triggerServerAction(url: string, settings?: AppSettings) {
    const response = await fetch(url, {
        method: 'POST',
        headers: settings ? headers(settings) : undefined,
    })

    if (!response.ok) {
        throw new Error(`Action failed with status ${response.status}`)
    }

    return response.text().catch(() => 'Done')
}

export async function fetchServerText(url: string, settings?: AppSettings) {
    const response = await fetch(url, {
        headers: settings ? headers(settings) : undefined,
    })

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
    }

    return response.text().catch(() => '')
}

export async function askCodex(settings: AppSettings, prompt: string, context?: string): Promise<AiRunDetails> {
    requireAppAuth(settings, 'use Codex in-app')

    const response = await fetch(joinUrl(settings.apiBaseUrl, settings.codexApiPath), {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ prompt, context }),
    })

    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to reach the Codex tool endpoint.'))
    }

    return {
        message: String(body.message || body.suggestion || body.error || 'No response.'),
        durationMs: numberValue(body.durationMs) ?? numberValue(body.duration_ms) ?? numberValue(body.elapsedMs),
        thoughtSummary: stringValue(body.thoughtSummary) || stringValue(body.summary) || stringValue(body.thoughts) || undefined,
        toolUses: normalizeToolUses(body.toolUses || body.tools || body.tool_calls),
        fileSummaries: normalizeFileSummaries(body.fileSummaries || body.files || body.changedFiles),
    }
}

export async function fetchAiModels(settings: AppSettings) {
    if (!settings.apiBaseUrl.trim()) {
        return []
    }

    const response = await fetch(joinUrl(settings.apiBaseUrl, 'ai/models'), {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to load model status.'))
    }

    const connected = Array.isArray(body.connected) ? body.connected.map(normalizeGptClient).filter(Boolean) as GptClient[] : []
    return connected
}

export async function fetchUserShares(settings: AppSettings) {
    requireCdnAuth(settings, 'load shares')

    const response = await fetch(joinUrl(settings.cdnBaseUrl, `share/user/${segment(settings.userId)}`), {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ([]))
    if (!response.ok) {
        throw new Error('Unable to load shares.')
    }

    return Array.isArray(body) ? body.map(normalizeShare).filter(Boolean) as ShareSummary[] : []
}

export async function createShare(settings: AppSettings, payload: { id: string; content: string; name?: string; path?: string; type?: string }) {
    requireCdnAuth(settings, 'create shares')

    const response = await fetch(joinUrl(settings.cdnBaseUrl, 'share'), {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to create share.'))
    }

    const share = normalizeShare(body)
    if (!share) {
        throw new Error('Create share returned an unexpected response.')
    }
    return share
}

export async function updateShare(settings: AppSettings, id: string, updates: { path?: string; content?: string; name?: string }) {
    requireCdnAuth(settings, 'update shares')

    const response = await fetch(joinUrl(settings.cdnBaseUrl, `share/${segment(id)}`), {
        method: 'PUT',
        headers: headers(settings),
        body: JSON.stringify(updates),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to update share.'))
    }

    const share = normalizeShare(body)
    if (!share) {
        throw new Error('Update share returned an unexpected response.')
    }
    return share
}

export async function deleteShare(settings: AppSettings, id: string) {
    requireCdnAuth(settings, 'delete shares')

    const response = await fetch(joinUrl(settings.cdnBaseUrl, `share/${segment(id)}`), {
        method: 'DELETE',
        headers: headers(settings),
    })
    if (!response.ok) {
        const body = await response.json().catch(() => ({} as Record<string, unknown>))
        throw new Error(String(body.error || 'Unable to delete share.'))
    }
}

export async function toggleShareLock(settings: AppSettings, id: string) {
    requireCdnAuth(settings, 'lock shares')

    const response = await fetch(joinUrl(settings.cdnBaseUrl, `share/lock/${segment(id)}`), {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to lock or unlock share.'))
    }

    const share = normalizeShare(body)
    if (!share) {
        throw new Error('Lock share returned an unexpected response.')
    }
    return share
}

export async function fetchShareTree(settings: AppSettings, id: string) {
    requireCdnAuth(settings, 'load share trees')

    const response = await fetch(joinUrl(settings.cdnBaseUrl, `share/tree/${segment(id)}`), {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => [])
    if (!response.ok) {
        throw new Error('Unable to load share tree.')
    }

    return normalizeShareTree(body)
}

export async function fetchTopDomains(settings: AppSettings) {
    if (!settings.cdnBaseUrl.trim()) {
        return []
    }

    const response = await fetch(`${joinUrl(settings.cdnBaseUrl, 'traffic/tps')}?fresh=1`, {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ([]))
    if (!response.ok) {
        throw new Error('Unable to load domain activity.')
    }

    return Array.isArray(body) ? body.map(normalizeTrafficDomain).filter(Boolean).slice(0, 5) as Array<{ name: string; tps?: number }> : []
}

export async function fetchDesktopAgentStatus(settings: AppSettings) {
    const response = await fetchDesktopAgentPath(settings, 'status')
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(String(asRecord(body).message || 'Desktop agent did not return a healthy status.'))
    }

    return normalizeDesktopStatus(body)
}

export async function runDesktopAgentCommand(settings: AppSettings, command: string) {
    const response = await fetchDesktopAgentPath(settings, 'command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(String(asRecord(body).message || 'Desktop command failed.'))
    }

    return normalizeDesktopStatus(body)
}

export async function fetchDesktopScreenshot(settings: AppSettings) {
    const response = await fetchDesktopAgentPath(settings, 'screenshot')
    const body = asRecord(await response.json().catch(() => ({})))
    if (!response.ok || !booleanValue(body.ok)) {
        throw new Error(String(body.message || 'Unable to capture Mac screen.'))
    }

    const mimeType = stringValue(body.mimeType) || 'image/png'
    const imageBase64 = stringValue(body.imageBase64)
    if (!imageBase64) {
        throw new Error('Desktop screenshot response did not include an image.')
    }

    return {
        ok: true,
        message: stringValue(body.message) || undefined,
        mimeType,
        imageBase64,
    }
}

export async function fetchNotes(settings: AppSettings) {
    requireAppAuth(settings, 'load notes')

    const response = await fetch(joinUrl(settings.apiBaseUrl, 'notes'), {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ([]))
    if (!response.ok) {
        throw new Error(String((body as { error?: string }).error || 'Unable to load notes.'))
    }

    return Array.isArray(body) ? body.map(normalizeNote).filter(Boolean) as Note[] : []
}

export async function createNote(settings: AppSettings, payload: { title: string; content: string }) {
    requireAppAuth(settings, 'save notes')

    const response = await fetch(joinUrl(settings.apiBaseUrl, 'notes'), {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ ...payload, source: 'app' }),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to create note.'))
    }

    const note = normalizeNote(body)
    if (!note) {
        throw new Error('Create note returned an unexpected response.')
    }
    return note
}

export async function updateNote(settings: AppSettings, id: string, payload: { title: string; content: string }) {
    requireAppAuth(settings, 'save notes')

    const response = await fetch(joinUrl(settings.apiBaseUrl, `notes/${segment(id)}`), {
        method: 'PUT',
        headers: headers(settings),
        body: JSON.stringify({ ...payload, source: 'app' }),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to update note.'))
    }

    const note = normalizeNote(body)
    if (!note) {
        throw new Error('Update note returned an unexpected response.')
    }
    return note
}

export async function deleteNote(settings: AppSettings, id: string) {
    requireAppAuth(settings, 'delete notes')

    const response = await fetch(joinUrl(settings.apiBaseUrl, `notes/${segment(id)}`), {
        method: 'DELETE',
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to delete note.'))
    }
}

export async function fetchDashboardUsers(settings: AppSettings) {
    requireAppAuth(settings, 'load users')

    const response = await fetch(joinUrl(settings.apiBaseUrl, 'users'), {
        headers: headers(settings),
    })
    const body = await readJsonObject(response, [])
    if (!response.ok) {
        throw new Error(String(asRecord(body).error || 'Unable to load users.'))
    }

    return Array.isArray(body) ? body.map(normalizeDashboardUser).filter(Boolean) as DashboardUser[] : []
}

export async function fetchDashboardRoles(settings: AppSettings) {
    requireAppAuth(settings, 'load roles')

    const response = await fetch(joinUrl(settings.apiBaseUrl, 'roles'), {
        headers: headers(settings),
    })
    const body = await readJsonObject(response, [])
    if (!response.ok) {
        throw new Error(String(asRecord(body).error || 'Unable to load roles.'))
    }

    return Array.isArray(body) ? body.map(normalizeRole).filter(Boolean) as DashboardRole[] : []
}

export async function fetchDashboardUserRoles(settings: AppSettings, userId: string) {
    requireAppAuth(settings, 'load user roles')

    const response = await fetch(joinUrl(settings.apiBaseUrl, `roles/user/${segment(userId)}`), {
        headers: headers(settings),
    })
    const body = await readJsonObject(response, [])
    if (!response.ok) {
        throw new Error(String(asRecord(body).error || 'Unable to load user roles.'))
    }

    return Array.isArray(body) ? body.map(normalizeUserRoleAssignment).filter(Boolean) as DashboardUserRoleAssignment[] : []
}

export async function setDashboardUserActive(settings: AppSettings, userId: string, active: boolean) {
    requireAppAuth(settings, 'update users')

    const response = await fetch(joinUrl(settings.apiBaseUrl, `user/${segment(userId)}/active`), {
        method: 'PUT',
        headers: headers(settings),
        body: JSON.stringify({ active }),
    })
    const body = await readJsonObject(response, {})
    if (!response.ok) {
        throw new Error(String(asRecord(body).error || 'Unable to update user.'))
    }
}

export async function assignDashboardUserRole(settings: AppSettings, userId: string, roleId: string) {
    return mutateDashboardUserRole(settings, userId, roleId, true)
}

export async function unassignDashboardUserRole(settings: AppSettings, userId: string, roleId: string) {
    return mutateDashboardUserRole(settings, userId, roleId, false)
}

async function mutateDashboardUserRole(settings: AppSettings, userId: string, roleId: string, assigned: boolean) {
    requireAppAuth(settings, assigned ? 'assign roles' : 'remove roles')

    const action = assigned ? 'assign' : 'unassign'
    const response = await fetch(joinUrl(settings.apiBaseUrl, `role/${action}/${segment(userId)}`), {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ role_id: roleId }),
    })
    const body = await readJsonObject(response, {})
    if (!response.ok) {
        throw new Error(String(asRecord(body).error || `Unable to ${action} role.`))
    }

    return body
}
