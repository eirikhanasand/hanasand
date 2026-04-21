'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { 
    Archive, 
    ArchiveRestore,
    Bot,
    FolderGit2,
    MessageSquarePlus, 
    Pencil, 
    Search,
    Settings2,
    Share2,
    SquareArrowOutUpRight,
    Trash2
} from 'lucide-react'

type SidebarTool = 'search' | 'workspace' | 'models' | null

type ChatSidebarProps = {
    activeConversationId: string | null
    archivedConversations: AIConversation[]
    conversations: AIConversation[]
    isAuthenticated: boolean
    search: string
    setSearch: (value: string) => void
    activeTool: SidebarTool
    onArchiveConversation: (id: string, archived: boolean) => void
    onDeleteConversation: (id: string) => void
    onNewConversation: () => void
    onRenameConversation: (id: string, title: string) => void
    onSelectConversation: (id: string) => void
    onToggleTool: (tool: SidebarTool) => void
    toolPanel: ReactNode
}

export default function ChatSidebar(props: ChatSidebarProps) {
    const {
        activeConversationId,
        activeTool,
        archivedConversations,
        conversations,
        isAuthenticated,
        search,
        setSearch,
        onArchiveConversation,
        onDeleteConversation,
        onNewConversation,
        onRenameConversation,
        onSelectConversation,
        onToggleTool,
        toolPanel,
    } = props
    const [editingTitle, setEditingTitle] = useState('')
    const [showArchived, setShowArchived] = useState(false)
    const activeConversation = [...conversations, ...archivedConversations].find((conversation) => conversation.id === activeConversationId) || null

    useEffect(() => {
        setEditingTitle(activeConversation?.title || '')
    }, [activeConversation?.id, activeConversation?.title])

    return (
        <aside className='flex h-full min-h-0 flex-col rounded-3xl bg-dark/35 p-3.5 outline outline-dark'>
            <div className='flex items-start justify-between gap-3 px-1 pb-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-bright/35'>
                        <Bot className='h-3.5 w-3.5 text-[#fd8738]' />
                        Hanasand AI
                    </div>
                    <p className='mt-2 text-sm text-bright/55'>{isAuthenticated ? 'Chats, repos, and live editor context' : 'Sign in to save chats and attach private workspaces'}</p>
                </div>
                <div className='flex items-center gap-1'>
                    <ToolButton icon={<Search className='h-4 w-4' />} active={activeTool === 'search'} onClick={() => onToggleTool(activeTool === 'search' ? null : 'search')} />
                    <ToolButton icon={<Share2 className='h-4 w-4' />} active={activeTool === 'workspace'} onClick={() => onToggleTool(activeTool === 'workspace' ? null : 'workspace')} />
                    <ToolButton icon={<Settings2 className='h-4 w-4' />} active={activeTool === 'models'} onClick={() => onToggleTool(activeTool === 'models' ? null : 'models')} />
                    <ToolButton icon={<SquareArrowOutUpRight className='h-4 w-4' />} onClick={() => window.location.href = '/s'} />
                </div>
            </div>

            <button type='button' onClick={onNewConversation} className='mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#fd8738] px-4 py-3 font-semibold text-black transition-opacity hover:opacity-90'>
                <MessageSquarePlus className='h-4 w-4' />
                New chat
            </button>

            {activeTool === 'search' ? (
                <div className='mb-3 rounded-2xl bg-dark/25 p-3 outline outline-dark'>
                    <label className='relative block'>
                        <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bright/30' />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Search chats and messages' className='w-full rounded-xl bg-dark/40 py-2.5 pl-10 pr-3 text-sm text-bright/90 outline outline-dark placeholder:text-bright/25' />
                    </label>
                </div>
            ) : null}

            {activeConversation ? (
                <div className='mb-3 rounded-2xl bg-dark/25 p-3 outline outline-dark'>
                    <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1'>
                            <p className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Selected chat</p>
                            <input
                                value={editingTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                onBlur={() => onRenameConversation(activeConversation.id, editingTitle)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault()
                                        onRenameConversation(activeConversation.id, editingTitle)
                                    }
                                }}
                                className='mt-2 w-full rounded-xl bg-dark/35 px-3 py-2 text-sm font-medium text-bright/90 outline outline-dark placeholder:text-bright/25'
                            />
                        </div>
                        <div className='flex items-center gap-1'>
                            <ActionButton icon={<Pencil className='h-3.5 w-3.5' />} label='Rename chat' onClick={() => onRenameConversation(activeConversation.id, editingTitle)} />
                            {activeConversation.archivedAt ? (
                                <ActionButton icon={<ArchiveRestore className='h-3.5 w-3.5' />} label='Restore chat' onClick={() => onArchiveConversation(activeConversation.id, false)} />
                            ) : (
                                <ActionButton icon={<Archive className='h-3.5 w-3.5' />} label='Archive chat' onClick={() => onArchiveConversation(activeConversation.id, true)} />
                            )}
                            <ActionButton icon={<Trash2 className='h-3.5 w-3.5' />} danger label='Delete chat' onClick={() => onDeleteConversation(activeConversation.id)} />
                        </div>
                    </div>
                    <div className='mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-bright/32'>
                        <Badge icon={<FolderGit2 className='h-3.5 w-3.5' />} text={formatWorkspaceLabel(activeConversation)} />
                        <Badge icon={<Share2 className='h-3.5 w-3.5' />} text={`${activeConversation.shareIds.length} share${activeConversation.shareIds.length === 1 ? '' : 's'}`} />
                    </div>
                </div>
            ) : null}

            {activeTool === 'workspace' || activeTool === 'models' ? (
                <div className='mb-3 min-h-0 rounded-2xl bg-dark/25 p-3 outline outline-dark'>{toolPanel}</div>
            ) : null}

            <SectionHeader label='Chats' count={conversations.length} />
            <ConversationList conversations={conversations} activeConversationId={activeConversationId} onSelectConversation={onSelectConversation} />

            <div className='mt-3 border-t border-dark/80 pt-3'>
                <button type='button' onClick={() => setShowArchived((prev) => !prev)} className='flex w-full cursor-pointer items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-bright/30'>
                    <span>Archived</span>
                    <span>{archivedConversations.length}</span>
                </button>
                {showArchived && archivedConversations.length ? (
                    <div className='mt-3'>
                        <ConversationList
                            conversations={archivedConversations}
                            activeConversationId={activeConversationId}
                            onSelectConversation={onSelectConversation}
                            archived
                            renderActions={(conversation) => (
                                <ActionButton icon={<ArchiveRestore className='h-3.5 w-3.5' />} label='Restore chat' onClick={() => onArchiveConversation(conversation.id, false)} />
                            )}
                        />
                    </div>
                ) : null}
            </div>
        </aside>
    )
}

function ConversationList({
    conversations,
    activeConversationId,
    onSelectConversation,
    archived = false,
    renderActions,
}: {
    conversations: AIConversation[]
    activeConversationId: string | null
    onSelectConversation: (id: string) => void
    archived?: boolean
    renderActions?: (conversation: AIConversation) => ReactNode
}) {
    return (
        <div className='min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
            {conversations.map((conversation) => (
                <div
                    key={conversation.id}
                    role='button'
                    tabIndex={0}
                    onClick={() => onSelectConversation(conversation.id)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onSelectConversation(conversation.id)
                        }
                    }}
                    className={`w-full cursor-pointer rounded-xl p-3 text-left outline transition-colors ${conversation.id === activeConversationId ? 'bg-[#fd8738]/12 outline-[#fd8738]/25' : 'bg-dark/30 outline-dark hover:bg-dark/45'}`}
                >
                    <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1'>
                            <div className='truncate text-sm font-semibold text-bright/90'>{conversation.title}</div>
                            <div className='mt-1 truncate text-xs text-bright/35'>{conversation.messages.at(-1)?.content || formatWorkspaceLabel(conversation)}</div>
                        </div>
                        {renderActions ? <div onClick={(event) => event.stopPropagation()}>{renderActions(conversation)}</div> : null}
                    </div>
                    <div className='mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-bright/28'>
                        <span>{archived ? 'Archived' : conversation.activeModel || conversation.preferredModel || 'Auto model'}</span>
                        <span>{conversation.messages.length}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}

function SectionHeader({ label, count }: { label: string, count: number }) {
    return (
        <div className='mb-3 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-bright/30'>
            <span>{label}</span>
            <span>{count}</span>
        </div>
    )
}

function ToolButton({ icon, active = false, onClick }: { icon: ReactNode, active?: boolean, onClick: () => void }) {
    return (
        <button type='button' onClick={onClick} className={`grid h-9 w-9 cursor-pointer place-items-center rounded-xl outline transition-colors ${active ? 'bg-[#fd8738]/12 text-[#fd8738] outline-[#fd8738]/20' : 'bg-dark/30 text-bright/55 outline-dark hover:text-bright/85'}`}>
            {icon}
        </button>
    )
}

function ActionButton({
    icon,
    label,
    onClick,
    danger = false,
}: {
    icon: ReactNode
    label: string
    onClick: () => void
    danger?: boolean
}) {
    return (
        <button type='button' aria-label={label} title={label} onClick={onClick} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg outline transition-colors ${danger ? 'bg-red-500/8 text-red-300 outline-red-500/15 hover:bg-red-500/15' : 'bg-dark/35 text-bright/55 outline-dark hover:text-[#fd8738]'}`}>
            {icon}
        </button>
    )
}

function Badge({ icon, text }: { icon: ReactNode, text: string }) {
    return (
        <span className='inline-flex items-center gap-1.5 rounded-full bg-dark/35 px-2.5 py-1 outline outline-dark'>
            <span className='text-[#fd8738]'>{icon}</span>
            <span>{text}</span>
        </span>
    )
}

function formatWorkspaceLabel(conversation: AIConversation) {
    if (typeof conversation.workspaceMeta?.repositoryName === 'string') {
        return conversation.workspaceMeta.repositoryName
    }
    if (conversation.workspaceKind && conversation.workspaceId) {
        return `${conversation.workspaceKind}: ${conversation.workspaceId}`
    }
    return 'No workspace attached'
}
