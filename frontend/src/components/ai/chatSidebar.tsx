'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, MessageSquarePlus, Pencil, Search, SquareArrowOutUpRight, Trash2 } from 'lucide-react'

type ChatSidebarProps = {
    activeConversationId: string | null
    archivedConversations: AIConversation[]
    conversations: AIConversation[]
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
        activeConversationId,
        archivedConversations,
        conversations,
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
    return (
        <aside className='flex min-h-0 flex-col border-r border-[#e0e5ed] bg-white p-4'>
            <div className='flex items-center justify-between gap-2 pb-4'>
                <button type='button' onClick={onNewConversation} className='inline-flex h-9 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#2b2f39]'>
                    <MessageSquarePlus className='h-4 w-4' />
                    New session
                </button>
                <div className='flex items-center gap-1'>
                    <IconButton label='Search sessions' icon={<Search className='h-4 w-4' />} active={searchOpen} onClick={() => setSearchOpen((prev) => !prev)} />
                    <Link href='/s' aria-label='Open context' className='grid h-9 w-9 place-items-center rounded-lg text-[#667085] transition-colors hover:bg-[#f8fafc] hover:text-[#171a21]'>
                        <SquareArrowOutUpRight className='h-4 w-4' />
                    </Link>
                </div>
            </div>

            {searchOpen ? (
                <label className='relative mb-3 block'>
                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]' />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder='Search sessions'
                        className='w-full rounded-lg border border-[#d8dee9] bg-white py-2.5 pl-10 pr-3 text-sm text-[#171a21] outline-none placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                    />
                </label>
            ) : null}

            <div className='mb-3 flex items-center justify-between px-1 text-[11px] font-semibold uppercase text-[#667085]'>
                <span>Sessions</span>
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

            <div className='mt-5 border-t border-[#e0e5ed] pt-4'>
                <button type='button' onClick={() => setShowArchived((prev) => !prev)} className='flex min-h-8 w-full items-center justify-between rounded-lg px-1 text-[11px] font-semibold uppercase text-[#667085] transition-colors hover:bg-[#f8fafc] hover:text-[#171a21]'>
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
            <div className='px-1 py-3 text-sm text-[#667085]'>
                No {archived ? 'archived' : 'active'} sessions yet.
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
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors ${conversation.id === activeConversationId ? 'bg-[#eef3ff] text-[#2546a8]' : 'text-[#344054] hover:bg-[#f8fafc]'}`}
                >
                    <div className='min-w-0 flex-1 overflow-hidden'>
                        <div className='truncate text-sm'>{conversationTitle(conversation.title)}</div>
                    </div>
                    <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
                        <MiniButton label={`Rename ${conversationTitle(conversation.title)}`} icon={<Pencil className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            const nextTitle = window.prompt('Rename review', conversationTitle(conversation.title))?.trim()
                            if (nextTitle) {
                                void onRenameConversation(conversation.id, nextTitle)
                            }
                        }} />
                        <MiniButton label={archived ? `Restore ${conversationTitle(conversation.title)}` : `Archive ${conversationTitle(conversation.title)}`} icon={archived ? <ArchiveRestore className='h-3.5 w-3.5' /> : <Archive className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            void onArchiveConversation(conversation.id, !archived)
                        }} />
                        <MiniButton label={`Delete ${conversationTitle(conversation.title)}`} danger icon={<Trash2 className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            void onDeleteConversation(conversation.id)
                        }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

function conversationTitle(title?: string | null) {
    const normalized = title?.trim()
    return !normalized || normalized === 'New chat' || normalized === 'New workspace review' || normalized === 'Workspace review' ? 'Review assistant' : normalized
}

function IconButton({ label, icon, active = false, onClick }: { label: string, icon: React.ReactNode, active?: boolean, onClick: () => void }) {
    return (
        <button type='button' aria-label={label} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${active ? 'bg-[#eef3ff] text-[#3056d3]' : 'text-[#667085] hover:bg-[#f8fafc] hover:text-[#171a21]'}`}>
            {icon}
        </button>
    )
}

function MiniButton({
    label,
    icon,
    danger = false,
    onClick,
}: {
    label: string
    icon: React.ReactNode
    danger?: boolean
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
    return (
        <button type='button' aria-label={label} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${danger ? 'text-[#b42318] hover:bg-[#fff1f0]' : 'text-[#667085] hover:bg-[#f8fafc] hover:text-[#171a21]'}`}>
            {icon}
        </button>
    )
}
