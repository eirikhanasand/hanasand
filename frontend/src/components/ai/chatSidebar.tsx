'use client'

import type { ReactNode } from 'react'
import { Bot, FolderGit2, MessageSquarePlus, Search, Settings2, Share2, SquareArrowOutUpRight } from 'lucide-react'

type SidebarTool = 'search' | 'workspace' | 'models' | null

type ChatSidebarProps = {
    activeConversationId: string | null
    conversations: AIConversation[]
    isAuthenticated: boolean
    search: string
    setSearch: (value: string) => void
    activeTool: SidebarTool
    onNewConversation: () => void
    onSelectConversation: (id: string) => void
    onToggleTool: (tool: SidebarTool) => void
    toolPanel: ReactNode
}

export default function ChatSidebar(props: ChatSidebarProps) {
    const { activeConversationId, activeTool, conversations, isAuthenticated, search, setSearch, onNewConversation, onSelectConversation, onToggleTool, toolPanel } = props

    return (
        <aside className='flex h-full min-h-0 flex-col rounded-2xl bg-dark/35 p-3 outline outline-dark'>
            <div className='flex items-start justify-between gap-3 px-1 pb-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-bright/35'>
                        <Bot className='h-3.5 w-3.5 text-[#fd8738]' />
                        Hanasand AI
                    </div>
                    <p className='mt-2 text-sm text-bright/55'>{isAuthenticated ? 'Chats and coding workspaces' : 'Sign in to save chats and attach private workspaces'}</p>
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
                <div className='mb-3 rounded-xl bg-dark/25 p-3 outline outline-dark'>
                    <label className='relative block'>
                        <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bright/30' />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Search chats' className='w-full rounded-xl bg-dark/40 py-2.5 pl-10 pr-3 text-sm text-bright/90 outline outline-dark placeholder:text-bright/25' />
                    </label>
                </div>
            ) : null}

            {activeTool === 'workspace' || activeTool === 'models' ? (
                <div className='mb-3 min-h-0 rounded-2xl bg-dark/25 p-3 outline outline-dark'>{toolPanel}</div>
            ) : null}

            <div className='mb-3 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-bright/30'>
                <span>Chats</span>
                <span>{conversations.length}</span>
            </div>

            <div className='min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
                {conversations.map((conversation) => (
                    <button key={conversation.id} type='button' onClick={() => onSelectConversation(conversation.id)} className={`w-full cursor-pointer rounded-xl p-3 text-left outline transition-colors ${conversation.id === activeConversationId ? 'bg-[#fd8738]/12 outline-[#fd8738]/25' : 'bg-dark/30 outline-dark hover:bg-dark/45'}`}>
                        <div className='truncate text-sm font-semibold text-bright/90'>{conversation.title}</div>
                        <div className='mt-1 truncate text-xs text-bright/35'>{formatWorkspaceLabel(conversation)}</div>
                        <div className='mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-bright/28'>
                            <span>{conversation.activeModel || conversation.preferredModel || 'Auto model'}</span>
                            <span>{conversation.messages.length}</span>
                        </div>
                    </button>
                ))}
            </div>
        </aside>
    )
}

function ToolButton({
    icon,
    active = false,
    onClick,
}: {
    icon: ReactNode
    active?: boolean
    onClick: () => void
}) {
    return (
        <button type='button' onClick={onClick} className={`grid h-9 w-9 cursor-pointer place-items-center rounded-xl outline transition-colors ${active ? 'bg-[#fd8738]/12 text-[#fd8738] outline-[#fd8738]/20' : 'bg-dark/30 text-bright/55 outline-dark hover:text-bright/85'}`}>
            {icon}
        </button>
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
