'use client'

import { MessageSquarePlus, Search, Sparkles } from 'lucide-react'

type ChatSidebarProps = {
    activeConversationId: string | null
    conversations: AIConversation[]
    isAuthenticated: boolean
    participants: number
    search: string
    setSearch: (value: string) => void
    onNewConversation: () => void
    onSelectConversation: (id: string) => void
}

export default function ChatSidebar(props: ChatSidebarProps) {
    const { activeConversationId, conversations, isAuthenticated, participants, search, setSearch, onNewConversation, onSelectConversation } = props

    return (
        <aside className='flex h-full flex-col gap-3 rounded-2xl bg-dark/35 p-4 outline outline-dark'>
            <button type='button' onClick={onNewConversation} className='flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#fd8738] px-4 py-3 font-semibold text-black transition-opacity hover:opacity-90'>
                <MessageSquarePlus className='h-4 w-4' /> New chat
            </button>
            <div className='rounded-xl bg-dark/25 p-3 outline outline-dark'>
                <div className='flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-bright/40'>
                    <Sparkles className='h-3.5 w-3.5 text-[#fd8738]' /> Workspace
                </div>
                <p className='mt-2 text-sm text-bright/60'>{isAuthenticated ? `${participants} live participants in the AI pool` : 'Sign in to save chats and sync repos into the editor.'}</p>
            </div>
            <label className='relative block'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bright/30' />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Search chats' className='w-full rounded-xl bg-dark/40 py-2.5 pl-10 pr-3 text-sm text-bright/90 outline outline-dark placeholder:text-bright/25' />
            </label>
            <div className='min-h-0 flex-1 space-y-2 overflow-y-auto'>
                {conversations.map((conversation) => (
                    <button key={conversation.id} type='button' onClick={() => onSelectConversation(conversation.id)} className={`w-full cursor-pointer rounded-xl p-3 text-left outline transition-colors ${conversation.id === activeConversationId ? 'bg-[#fd8738]/12 outline-[#fd8738]/25' : 'bg-dark/30 outline-dark hover:bg-dark/45'}`}>
                        <div className='truncate text-sm font-semibold text-bright/90'>{conversation.title}</div>
                        <div className='mt-1 truncate text-xs text-bright/35'>{formatWorkspaceLabel(conversation)}</div>
                        <div className='mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-bright/28'>
                            <span>{conversation.activeModel || conversation.preferredModel || 'Auto model'}</span>
                            <span>{conversation.messages.length} msgs</span>
                        </div>
                    </button>
                ))}
            </div>
        </aside>
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
