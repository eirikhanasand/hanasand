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
        <aside className='flex min-h-0 flex-col border-r border-bright/10 p-4'>
            <div className='flex items-center justify-between gap-2 pb-4'>
                <button type='button' onClick={onNewConversation} className='inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-[#f1eee7] transition-colors hover:bg-bright/8'>
                    <MessageSquarePlus className='h-4 w-4' />
                    New
                </button>
                <div className='flex items-center gap-1'>
                    <IconButton label='Search chats' icon={<Search className='h-4 w-4' />} active={searchOpen} onClick={() => setSearchOpen((prev) => !prev)} />
                    <Link href='/s' aria-label='Open editor' className='grid h-9 w-9 place-items-center rounded-full text-[#a0a09b] transition-colors hover:bg-bright/8 hover:text-[#eeeeea]'>
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
                        className='w-full rounded-full border border-bright/10 bg-transparent py-2.5 pl-10 pr-3 text-sm text-[#eeeeea] outline-none placeholder:text-[#777772]'
                    />
                </label>
            ) : null}

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

            <div className='mt-5 border-t border-bright/10 pt-4'>
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
            <div className='px-1 py-3 text-sm text-[#858581]'>
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
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${conversation.id === activeConversationId ? 'bg-bright/10 text-[#f1eee7]' : 'text-[#d3d3ce] hover:bg-bright/8'}`}
                >
                    <div className='min-w-0 flex-1 overflow-hidden'>
                        <div className='truncate text-sm'>{conversation.title}</div>
                    </div>
                    <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
                        <MiniButton label={`Rename ${conversation.title}`} icon={<Pencil className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            const nextTitle = window.prompt('Rename chat', conversation.title)?.trim()
                            if (nextTitle) {
                                void onRenameConversation(conversation.id, nextTitle)
                            }
                        }} />
                        <MiniButton label={archived ? `Restore ${conversation.title}` : `Archive ${conversation.title}`} icon={archived ? <ArchiveRestore className='h-3.5 w-3.5' /> : <Archive className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            void onArchiveConversation(conversation.id, !archived)
                        }} />
                        <MiniButton label={`Delete ${conversation.title}`} danger icon={<Trash2 className='h-3.5 w-3.5' />} onClick={(event) => {
                            event.stopPropagation()
                            void onDeleteConversation(conversation.id)
                        }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

function IconButton({ label, icon, active = false, onClick }: { label: string, icon: React.ReactNode, active?: boolean, onClick: () => void }) {
    return (
        <button type='button' aria-label={label} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${active ? 'bg-bright/10 text-[#eeeeea]' : 'text-[#a0a09b] hover:bg-bright/8 hover:text-[#eeeeea]'}`}>
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
        <button type='button' aria-label={label} onClick={onClick} className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${danger ? 'text-[#d29a95] hover:bg-red-500/10' : 'text-[#a0a09b] hover:bg-bright/8 hover:text-[#eeeeea]'}`}>
            {icon}
        </button>
    )
}
