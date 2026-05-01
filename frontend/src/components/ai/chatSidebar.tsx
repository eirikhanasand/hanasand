'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, MessageSquarePlus, Pencil, Search, SquareArrowOutUpRight, Trash2 } from 'lucide-react'

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
        <aside className='flex min-h-0 flex-col border-r border-[#2b2b28] bg-[#242521] p-4'>
            <div className='flex items-center justify-between gap-2 pb-4'>
                <button type='button' onClick={onNewConversation} className='inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#f1eee7] transition-colors hover:bg-[#30312d]'>
                    <MessageSquarePlus className='h-4 w-4' />
                    New
                </button>
                <div className='flex items-center gap-1'>
                    <IconButton icon={<Search className='h-4 w-4' />} active={searchOpen} onClick={() => setSearchOpen((prev) => !prev)} />
                    <Link href='/s' className='grid h-9 w-9 place-items-center rounded-lg text-[#a0a09b] transition-colors hover:bg-[#30312d] hover:text-[#eeeeea]'>
                        <SquareArrowOutUpRight className='h-4 w-4' />
                    </Link>
                </div>
            </div>

            {searchOpen ? (
                <label className='relative mb-3 block'>
                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#858581]' />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder='Search chats'
                        className='w-full rounded-lg border border-[#353631] bg-[#20211d] py-2.5 pl-10 pr-3 text-sm text-[#eeeeea] outline-none placeholder:text-[#777772]'
                    />
                </label>
            ) : null}

            <div className='mb-5 px-2'>
                <div className='text-[11px] uppercase tracking-[0.22em] text-[#858581]'>Hanasand AI</div>
                <div className='mt-2 truncate text-sm font-semibold text-[#f1eee7]'>{activeLabel}</div>
                <div className='mt-1 text-xs text-[#9a9a95]'>{isAuthenticated ? 'Chats sync with workspace context.' : 'Sign in to save chats.'}</div>
            </div>

            <div className='mb-3 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.16em] text-[#858581]'>
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

            <div className='mt-5 border-t border-[#343530] pt-4'>
                <button type='button' onClick={() => setShowArchived((prev) => !prev)} className='flex w-full items-center justify-between px-1 text-[11px] uppercase tracking-[0.16em] text-[#858581]'>
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
            <div className='rounded-lg bg-[#1f201d] px-3 py-4 text-sm text-[#858581]'>
                No {archived ? 'archived' : 'active'} chats yet.
            </div>
        )
    }

    return (
        <div className='min-h-0 flex-1 space-y-1 overflow-y-auto pr-1'>
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
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors ${conversation.id === activeConversationId ? 'bg-[#383934] text-[#f1eee7]' : 'text-[#d3d3ce] hover:bg-[#30312d]'}`}
                >
                    <div className='min-w-0 flex-1 overflow-hidden'>
                        <div className='truncate text-sm'>{conversation.title}</div>
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
        <button type='button' onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${active ? 'bg-[#383934] text-[#eeeeea]' : 'text-[#a0a09b] hover:bg-[#30312d] hover:text-[#eeeeea]'}`}>
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
        <button type='button' onClick={onClick} className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${danger ? 'text-[#d29a95] hover:bg-[#55302d]' : 'text-[#a0a09b] hover:bg-[#3a3b36] hover:text-[#eeeeea]'}`}>
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
