'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, FolderGit2, MessageSquarePlus, Pencil, Search, SquareArrowOutUpRight, Trash2 } from 'lucide-react'

type ChatSidebarProps = {
    activeConversation: AIConversation | null
    activeConversationId: string | null
    archivedConversations: AIConversation[]
    conversations: AIConversation[]
    isAuthenticated: boolean
    search: string
    setSearch: (value: string) => void
    onArchiveConversation: (id: string, archived: boolean) => void
    onDeleteConversation: (id: string) => void
    onNewConversation: () => void
    onRenameConversation: (id: string, title: string) => void
    onSelectConversation: (id: string) => void
}

export default function ChatSidebar(props: ChatSidebarProps) {
    const {
        activeConversation,
        activeConversationId,
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
    } = props
    const [showArchived, setShowArchived] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const activeLabel = useMemo(() => workspaceLabel(activeConversation), [activeConversation])

    return (
        <aside className='flex min-h-0 flex-col rounded-2xl bg-dark/30 p-3 outline outline-dark'>
            <div className='flex items-center justify-between gap-2 pb-3'>
                <button type='button' onClick={onNewConversation} className='inline-flex items-center gap-2 rounded-xl bg-[#fd8738] px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90'>
                    <MessageSquarePlus className='h-4 w-4' />
                    New
                </button>
                <div className='flex items-center gap-1'>
                    <IconButton icon={<Search className='h-4 w-4' />} active={searchOpen} onClick={() => setSearchOpen((prev) => !prev)} />
                    <Link href='/s' className='grid h-9 w-9 place-items-center rounded-xl bg-dark/30 text-bright/55 outline outline-dark transition-colors hover:text-bright/85'>
                        <SquareArrowOutUpRight className='h-4 w-4' />
                    </Link>
                </div>
            </div>

            {searchOpen ? (
                <label className='relative mb-3 block'>
                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bright/30' />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder='Search chats'
                        className='w-full rounded-xl bg-dark/35 py-2.5 pl-10 pr-3 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24'
                    />
                </label>
            ) : null}

            <div className='mb-3 rounded-2xl bg-dark/25 px-3 py-3 outline outline-dark'>
                <div className='text-[11px] uppercase tracking-[0.22em] text-bright/30'>Hanasand AI</div>
                <div className='mt-2 truncate text-sm text-bright/82'>{activeLabel}</div>
                <div className='mt-1 text-xs text-bright/38'>
                    {isAuthenticated ? 'Your chats stay attached to repos and shares.' : 'Sign in to save chats and workspaces.'}
                </div>
            </div>

            <div className='mb-3 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-bright/30'>
                <span>Chats</span>
                <span>{conversations.length}</span>
            </div>

            <ConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                onArchiveConversation={onArchiveConversation}
                onDeleteConversation={onDeleteConversation}
                onRenameConversation={onRenameConversation}
                onSelectConversation={onSelectConversation}
            />

            <div className='mt-3 border-t border-dark/80 pt-3'>
                <button type='button' onClick={() => setShowArchived((prev) => !prev)} className='flex w-full items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-bright/30'>
                    <span>Archived</span>
                    <span>{archivedConversations.length}</span>
                </button>
                {showArchived ? (
                    <div className='mt-3'>
                        <ConversationList
                            conversations={archivedConversations}
                            activeConversationId={activeConversationId}
                            onArchiveConversation={onArchiveConversation}
                            onDeleteConversation={onDeleteConversation}
                            onRenameConversation={onRenameConversation}
                            onSelectConversation={onSelectConversation}
                            archived
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
    onArchiveConversation,
    onDeleteConversation,
    onRenameConversation,
    onSelectConversation,
    archived = false,
}: {
    conversations: AIConversation[]
    activeConversationId: string | null
    onArchiveConversation: (id: string, archived: boolean) => void
    onDeleteConversation: (id: string) => void
    onRenameConversation: (id: string, title: string) => void
    onSelectConversation: (id: string) => void
    archived?: boolean
}) {
    if (!conversations.length) {
        return (
            <div className='rounded-xl bg-dark/20 px-3 py-4 text-sm text-bright/35 outline outline-dark'>
                No {archived ? 'archived' : 'active'} chats yet.
            </div>
        )
    }

    return (
        <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1'>
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
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 outline transition-colors ${conversation.id === activeConversationId ? 'bg-[#fd8738]/12 outline-[#fd8738]/18' : 'bg-dark/25 outline-transparent hover:bg-dark/35 hover:outline-dark'}`}
                >
                    <div className='min-w-0 flex-1 overflow-hidden'>
                        <div className='truncate text-sm text-bright/88'>{conversation.title}</div>
                    </div>
                    <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
                        <MiniButton icon={<Pencil className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            const nextTitle = window.prompt('Rename chat', conversation.title)?.trim()
                            if (nextTitle) {
                                void onRenameConversation(conversation.id, nextTitle)
                            }
                        }} />
                        <MiniButton icon={archived ? <ArchiveRestore className='h-3.5 w-3.5' /> : <Archive className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            void onArchiveConversation(conversation.id, !archived)
                        }} />
                        <MiniButton danger icon={<Trash2 className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            void onDeleteConversation(conversation.id)
                        }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

function IconButton({ icon, active = false, onClick }: { icon: React.ReactNode, active?: boolean, onClick: () => void }) {
    return (
        <button type='button' onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-xl outline transition-colors ${active ? 'bg-[#fd8738]/12 text-[#fd8738] outline-[#fd8738]/20' : 'bg-dark/30 text-bright/55 outline-dark hover:text-bright/85'}`}>
            {icon}
        </button>
    )
}

function MiniButton({
    icon,
    danger = false,
    onClick,
}: {
    icon: React.ReactNode
    danger?: boolean
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
    return (
        <button type='button' onClick={onClick} className={`grid h-7 w-7 place-items-center rounded-lg outline transition-colors ${danger ? 'bg-red-500/8 text-red-300 outline-red-500/10 hover:bg-red-500/15' : 'bg-dark/35 text-bright/55 outline-dark hover:text-[#fd8738]'}`}>
            {icon}
        </button>
    )
}

function workspaceLabel(conversation: AIConversation | null) {
    if (!conversation) {
        return 'Start a conversation'
    }
    if (typeof conversation.workspaceMeta?.repositoryName === 'string') {
        return conversation.workspaceMeta.repositoryName
    }
    if (conversation.workspaceKind === 'share') {
        return 'Attached share'
    }
    if (conversation.workspaceKind === 'repo') {
        return 'Attached repository'
    }
    return 'No workspace attached'
}
