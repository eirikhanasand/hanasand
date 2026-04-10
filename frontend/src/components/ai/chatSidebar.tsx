'use client'

import { MessageSquarePlus, Search } from 'lucide-react'

type ChatSidebarProps = {
    activeConversationId: string | null
    conversations: AIConversation[]
    search: string
    setSearch: (value: string) => void
    onNewConversation: () => void
    onSelectConversation: (id: string) => void
}

export default function ChatSidebar({
    activeConversationId,
    conversations,
    search,
    setSearch,
    onNewConversation,
    onSelectConversation,
}: ChatSidebarProps) {
    return (
        <aside className='flex h-full w-[18rem] flex-col gap-3 rounded-2xl bg-dark/35 p-4 outline outline-dark'>
            <button
                type='button'
                onClick={onNewConversation}
                className='flex items-center justify-center gap-2 rounded-xl bg-[#fd8738] px-4 py-3 font-semibold text-black transition-opacity hover:opacity-90'
            >
                <MessageSquarePlus className='h-4 w-4' />
                New chat
            </button>
            <label className='relative block'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bright/30' />
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder='Search chats'
                    className='w-full rounded-xl bg-dark/40 py-2.5 pl-10 pr-3 text-sm text-bright/90 outline outline-dark placeholder:text-bright/25'
                />
            </label>
            <div className='min-h-0 flex-1 space-y-2 overflow-y-auto'>
                {conversations.map((conversation) => (
                    <button
                        key={conversation.id}
                        type='button'
                        onClick={() => onSelectConversation(conversation.id)}
                        className={`w-full rounded-xl p-3 text-left outline transition-colors ${
                            conversation.id === activeConversationId
                                ? 'bg-[#fd8738]/12 outline-[#fd8738]/25'
                                : 'bg-dark/30 outline-dark hover:bg-dark/45'
                        }`}
                    >
                        <div className='truncate text-sm font-semibold text-bright/90'>{conversation.title}</div>
                        <div className='mt-1 truncate text-xs text-bright/35'>
                            {conversation.workspaceId ? `${conversation.workspaceKind}: ${conversation.workspaceId}` : 'No workspace attached'}
                        </div>
                    </button>
                ))}
            </div>
        </aside>
    )
}
