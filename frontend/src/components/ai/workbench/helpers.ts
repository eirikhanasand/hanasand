'use client'

import defaultModelMetrics from '@/components/gpt/defaultModelMetrics'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { listTreePaths } from '../shareTree'

export type AiToolCall = {
    action: 'read_share' | 'update_share' | 'http_request' | 'browser_task' | 'scaffold_nextjs_docker' | 'create_vm' | 'create_project' | 'run_terminal_command'
    shareId?: string
    path?: string
    content?: string
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    projectName?: string
    vmName?: string
    command?: string
    timeoutMs?: number
    captureScreenshot?: boolean
}

export function deriveLastToolState(conversations: AIConversation[]): AIRuntimeToolRun | null {
    const lastToolMessage = [...conversations]
        .flatMap((conversation) => conversation.messages.map((message) => ({ conversation, message })))
        .filter((entry) => entry.message.role === 'tool')
        .sort((left, right) => new Date(right.message.createdAt).getTime() - new Date(left.message.createdAt).getTime())[0] || null

    if (!lastToolMessage) {
        return null
    }

    return {
        conversationId: lastToolMessage.conversation.id || null,
        label: typeof lastToolMessage.message.metadata?.tool === 'string'
            ? lastToolMessage.message.metadata.tool
            : typeof lastToolMessage.message.metadata?.toolId === 'string'
                ? lastToolMessage.message.metadata.toolId
                : 'tool',
        detail: lastToolMessage.message.content || null,
        state: lastToolMessage.message.error
            ? 'error'
            : typeof lastToolMessage.message.metadata?.toolState === 'string'
                ? lastToolMessage.message.metadata.toolState as AIRuntimeToolState
                : 'completed',
        updatedAt: lastToolMessage.message.createdAt || new Date().toISOString(),
    }
}

export function deriveLastFailure(
    conversations: AIConversation[],
    statusNotice: string | null,
): AIRuntimeFailure | null {
    const lastFailure = [...conversations]
        .flatMap((conversation) => conversation.messages.map((message) => ({ conversation, message })))
        .filter((entry) => entry.message.error)
        .sort((left, right) => new Date(right.message.createdAt).getTime() - new Date(left.message.createdAt).getTime())[0] || null

    if (lastFailure) {
        return {
            message: lastFailure.message.content,
            conversationId: lastFailure.conversation.id,
            updatedAt: lastFailure.message.createdAt,
            source: lastFailure.message.role === 'tool' ? 'tool' : 'conversation',
        }
    }

    if (!statusNotice) {
        return null
    }

    return {
        message: statusNotice,
        conversationId: null,
        updatedAt: new Date().toISOString(),
        source: 'conversation',
    }
}

export function chooseNewestToolRun(serverToolRun: AIRuntimeToolRun | null, localToolRun: AIRuntimeToolRun | null) {
    if (!serverToolRun) return localToolRun
    if (!localToolRun) return serverToolRun

    return new Date(localToolRun.updatedAt).getTime() >= new Date(serverToolRun.updatedAt).getTime()
        ? localToolRun
        : serverToolRun
}

export function chooseNewestFailure(serverFailure: AIRuntimeFailure | null, localFailure: AIRuntimeFailure | null) {
    if (!serverFailure) return localFailure
    if (!localFailure) return serverFailure

    return new Date(localFailure.updatedAt).getTime() >= new Date(serverFailure.updatedAt).getTime()
        ? localFailure
        : serverFailure
}

export function createConversation(clientName: string | null = null): AIConversation {
    const timestamp = new Date().toISOString()
    return {
        id: crypto.randomUUID(),
        ownerId: getCookie('id') || '',
        title: 'New chat',
        preferredModel: clientName,
        activeModel: clientName,
        modelStrategy: 'auto',
        workspaceId: null,
        workspaceKind: null,
        shareIds: [],
        workspaceMeta: {},
        messages: [],
        collaboration: {
            role: 'owner',
            canInvite: true,
            seatLimit: 5,
            seatCount: 0,
            remainingSeats: 5,
            collaborators: [],
        },
        metrics: defaultModelMetrics(),
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
    }
}

export function withRepositorySync(
    repo: AIImportedRepo,
    update: {
        status: 'ready' | 'syncing' | 'error'
        source: 'import' | 'refresh' | 'sync'
        message: string
    },
): AIImportedRepo {
    const event: AIRepositorySyncEvent = {
        timestamp: new Date().toISOString(),
        status: update.status,
        source: update.source,
        message: update.message,
    }

    return {
        ...repo,
        syncStatus: update.status,
        lastSyncedAt: update.status === 'ready' ? event.timestamp : repo.lastSyncedAt,
        lastSyncError: update.status === 'error' ? update.message : null,
        syncHistory: [event, ...(repo.syncHistory || [])].slice(0, 10),
    }
}

export function withWorkspaceActivity(
    workspaceMeta: Record<string, unknown>,
    update: {
        action: string
        path?: string
        source?: 'share' | 'repository-sync' | 'scaffold'
    },
) {
    const existingRecentPaths = Array.isArray(workspaceMeta.recentPaths)
        ? workspaceMeta.recentPaths.filter((entry): entry is string => typeof entry === 'string')
        : []
    const recentPaths = update.path
        ? [update.path, ...existingRecentPaths.filter((entry) => entry !== update.path)].slice(0, 8)
        : existingRecentPaths

    return {
        ...workspaceMeta,
        recentPaths,
        lastChangedPath: update.path || workspaceMeta.lastChangedPath || null,
        lastWorkspaceAction: update.action,
        lastWorkspaceActionAt: new Date().toISOString(),
        workspaceSource: update.source || workspaceMeta.workspaceSource || null,
    }
}

export function appendError(
    conversation: AIConversation,
    content: string,
    metrics?: GPT_ModelMetrics,
    modelName?: string | null,
): AIConversation {
    const messages = [...conversation.messages]
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.pending) {
        messages[messages.length - 1] = { ...lastMessage, content, pending: false, error: true, modelName: modelName || lastMessage.modelName || null }
    } else {
        messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            error: true,
            createdAt: new Date().toISOString(),
            modelName: modelName || null,
        })
    }

    return {
        ...conversation,
        updatedAt: new Date().toISOString(),
        metrics: metrics || { ...conversation.metrics, status: 'error', lastError: content },
        messages,
    }
}

export function resolveModelName(conversation: AIConversation, clients: GPT_Client[]) {
    const names = clients.map((client) => client.name)
    return [conversation.preferredModel, conversation.activeModel, names[0]].find((name) => name && names.includes(name)) || null
}

export async function buildWorkspaceContext(
    conversation: AIConversation,
    importedRepos: AIImportedRepo[],
    shareContents: Record<string, string>,
    shareTrees: Record<string, Tree>,
    shareFileContents: Record<string, string>,
) {
    const sections: string[] = []

    if (conversation.shareIds.length) {
        const activeShareId = conversation.workspaceId || conversation.shareIds[0]
        const shareSummary = conversation.shareIds.map((shareId) => {
            const content = shareContents[shareId] || ''
            const prefix = shareId === activeShareId ? 'active' : 'attached'
            return `${prefix} share ${shareId}:\n${content.slice(0, shareId === activeShareId ? 12000 : 2500)}`
        })
        sections.push(`Attached Hanasand shares:\n${shareSummary.join('\n\n')}`)
    }

    const repositoryId = typeof conversation.workspaceMeta?.repositoryId === 'string'
        ? conversation.workspaceMeta.repositoryId
        : conversation.workspaceKind === 'repo'
            ? conversation.workspaceId
            : null
    if (repositoryId) {
        const repo = importedRepos.find((item) => item.id === repositoryId)
        if (repo) {
            const rootId = conversation.workspaceId || repo.id
            const selectedPath = String(conversation.workspaceMeta?.selectedFilePath || repo.files[0]?.path || '')
            const selectedFile = repo.files.find((file) => file.path === selectedPath) || repo.files[0]
            const treePaths = listTreePaths(shareTrees[rootId])
            const liveContent = shareFileContents[`${rootId}:${selectedPath}`]
            sections.push([
                `Repository: ${repo.fullName} on branch ${repo.branch}.`,
                `Repository files:\n${(treePaths.length ? treePaths : repo.files.map((file) => file.path)).slice(0, 80).join('\n')}`,
                selectedFile ? `Focused file (${selectedFile.path}):\n${(liveContent || selectedFile.content).slice(0, 12000)}` : null,
            ].filter(Boolean).join('\n\n'))
        }
    }

    return sections.join('\n\n').trim()
}

export function buildSystemPrompt({
    conversation,
    workspaceContext,
}: {
    conversation: AIConversation
    workspaceContext: string | null
}) {
    return [
        'You are Hanasand AI, an app-style coding assistant inside Hanasand.',
        'Behave like Codex inside Hanasand: be direct, calm, concise, practical, and action-oriented.',
        'Prefer concrete next steps, patch-ready code, and careful reasoning over marketing language.',
        'Optimize for fast product progress: make a reasonable assumption for ambiguous build requests, create or attach a workspace early, edit the smallest useful surface, run the relevant check, and report the result.',
        'Keep visible replies compact. For ordinary build/debug turns, answer in 3-6 high-signal bullets or a short paragraph plus tool tags; do not narrate routine inspection or repeat file context back to the user.',
        'You have built-in access to advanced reasoning, repo-aware file inspection/editing tools, local command execution, managed background processes, Playwright browser verification, and live web search outside this prompt. Think privately, inspect before editing, verify in-browser when building web apps, and do not say you lack internet access, shell access, repository access, browser access, or current date awareness when those tools would help.',
        'If a capability is missing but can be added safely, improve your own workflow by creating reusable scripts, helpers, or tools rather than repeating the same manual sequence.',
        'When working inside the Hanasand repository, read agents/START_HERE.md first. For native app or website-to-app parity work, also read agents/DESKTOP_APP_DEVELOPMENT.md and follow it as the operating playbook.',
        'For requests like "implement the share functionality from the website", independently trace the website component, API helper, backend route, response shape, native app foothold, and verification commands before editing. Do not ask the user for endpoint names or file paths that the repository can reveal.',
        'If a preferred model is unavailable, continue with the current connected model.',
        'When a user asks you to read or update an attached share, make an authenticated HTTP request, prepare a remote project, create a VM, or run a command in an attached share terminal, you may emit one or more tool tags on their own line.',
        'Supported tags:',
        '<hanasand-tool>{"action":"read_share","shareId":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"update_share","shareId":"optional","path":"optional","content":"new file content"}</hanasand-tool>',
        '<hanasand-tool>{"action":"http_request","url":"https://...","method":"GET","headers":{"Accept":"application/json"},"body":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"browser_task","url":"https://...","captureScreenshot":true,"timeoutMs":20000}</hanasand-tool>',
        '<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"optional","shareId":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"create_vm","vmName":"northstar-admin"}</hanasand-tool>',
        '<hanasand-tool>{"action":"create_project","projectName":"Northstar Admin","vmName":"northstar-admin","shareId":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"run_terminal_command","shareId":"optional","command":"pwd && ls","timeoutMs":20000}</hanasand-tool>',
        'Only emit a tool tag when the user clearly asked for the action. Keep normal explanation outside the tag.',
        'Use scaffold_nextjs_docker or create_project when the user asks for a production-style starter, Dockerized Next.js app, or a full workspace you can keep extending from the browser.',
        'For website/app requests, prefer this loop unless the user asks otherwise: scaffold or attach workspace -> implement files -> run a focused terminal check -> verify UI in browser -> summarize what shipped and what remains.',
        'Use browser_task for preview/public-page checks, visual QA requests, mobile/browser evidence, and "look at it" requests after a workspace or URL exists. It should produce URL, title, text excerpt, console/page errors, and screenshot availability before you claim the UI works.',
        'Do not run terminal, read_share, or update_share tools before a workspace is attached. If no workspace exists and the user asks for building, visual edits, tests, screenshots, or deployment, scaffold/create a workspace first or ask for a repo/share only when that exact existing code is required.',
        'Ask a clarifying question only when the next action would be destructive, security-sensitive, billing-related, or impossible to infer. Otherwise choose a sensible default and keep moving.',
        `Conversation strategy: ${conversation.modelStrategy}. Preferred model: ${conversation.preferredModel || 'auto'}.`,
        workspaceContext ? `Workspace context:\n${workspaceContext}` : 'No workspace is attached yet.',
    ].join('\n\n')
}

export function toConversationPayload(conversation: Partial<AIConversation>) {
    return {
        id: conversation.id,
        title: conversation.title,
        preferredModel: conversation.preferredModel ?? null,
        activeModel: conversation.activeModel ?? null,
        modelStrategy: conversation.modelStrategy ?? 'auto',
        workspaceKind: conversation.workspaceKind ?? null,
        workspaceId: conversation.workspaceId ?? null,
        shareIds: conversation.shareIds ?? [],
        workspaceMeta: conversation.workspaceMeta ?? {},
        archivedAt: conversation.archivedAt ?? null,
    }
}

export function parseToolCalls(content: string): AiToolCall[] {
    const matches = [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)]
    const results: AiToolCall[] = []
    for (const match of matches) {
        try {
            const parsed = JSON.parse(match[1]) as AiToolCall
            if (parsed?.action) {
                results.push(parsed)
            }
        } catch (error) {
            console.error('Invalid Hanasand tool payload', error)
        }
    }
    return results
}

export function stripToolTags(content: string) {
    return content.replace(/<hanasand-tool>[\s\S]*?<\/hanasand-tool>/g, '').replace(/\n{3,}/g, '\n\n')
}

export function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `vm-${randomId(6).toLowerCase()}`
}

export function createWorkbenchSocket(url: string) {
    if (typeof window !== 'undefined') {
        const customFactory = (window as typeof window & {
            __HANASAND_CREATE_SOCKET__?: (targetUrl: string) => WebSocket
        }).__HANASAND_CREATE_SOCKET__
        if (typeof customFactory === 'function') {
            return customFactory(url)
        }
    }

    return new WebSocket(url)
}
