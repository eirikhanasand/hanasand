'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import GPT_Content from '@components/gpt/content'
import GPT_EmptyState from '@components/gpt/emptyState'
import GPT_Header from '@components/gpt/header'
import TestClientPopup from '@components/gpt/testClientPopup'
import useGptPageState from '@components/gpt/useGptPageState'

export default function GPT_Page() {
    const gpt = useGptPageState()

    return (
        <>
            <div className='h-full w-full overflow-y-auto'>
                <div className='mx-auto flex w-full max-w-330 flex-col gap-4 px-4 pb-4 pt-6 sm:px-6 md:px-8 md:pt-8'>
                    <div className='flex items-center justify-between gap-4'>
                        <div>
                            <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>System</p>
                            <h1 className='mt-1 text-2xl font-semibold text-bright/90'>AI</h1>
                        </div>
                        <Link
                            href='/dashboard/system'
                            className='flex items-center gap-2 rounded-md bg-bright/3 px-4 py-2 text-sm text-bright/80 outline outline-dark transition-colors hover:bg-bright/5'
                        >
                            <ArrowLeft className='h-4 w-4' />
                            Back to system
                        </Link>
                    </div>
                    <GPT_Header isConnected={gpt.isConnected} participants={gpt.participants} />
                    {gpt.clients.length ? <GPT_Content clients={gpt.clients} onTestClient={gpt.openChat} /> : <GPT_EmptyState />}
                </div>
            </div>
            {gpt.chatSession && gpt.activeClient ? (
                <TestClientPopup
                    client={gpt.activeClient}
                    conversationId={gpt.chatSession.conversationId}
                    isSending={gpt.chatSession.isSending}
                    messages={gpt.chatSession.messages}
                    metrics={gpt.chatSession.metrics}
                    onClose={gpt.closeChat}
                    onSend={gpt.sendPrompt}
                />
            ) : null}
        </>
    )
}
