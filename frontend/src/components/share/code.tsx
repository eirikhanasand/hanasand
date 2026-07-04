'use client'

import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import '@styles/github.css'
import Editor from '@/components/share/editor'
import { applyHighlightedCode } from './codeUtils'
import { type ShareConflict, type SharePresenceUser, useShareCodeSocket } from './useShareCodeSocket'

type CodeProps = {
    id: string
    setParticipants: Dispatch<SetStateAction<number>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    setClickedWord: Dispatch<SetStateAction<string | null>>
    editingContent: string
    setEditingContent: Dispatch<SetStateAction<string>>
    displayLineNumbers: boolean
    syntaxHighlighting: boolean
    setError: Dispatch<SetStateAction<string | boolean | null>>
    setSaveState: Dispatch<SetStateAction<'saved' | 'saving' | 'queued'>>
    saveState: 'saved' | 'saving' | 'queued'
    setPresenceUsers: Dispatch<SetStateAction<SharePresenceUser[]>>
    setSelfClientId: Dispatch<SetStateAction<string | null>>
    setRemoteNotice: Dispatch<SetStateAction<string | null>>
    setConflict: Dispatch<SetStateAction<ShareConflict | null>>
    connect?: boolean
    editorPatch?: { value: string; nonce: number } | null
}

export default function Code({
    id,
    setParticipants,
    setIsConnected,
    share,
    setShare,
    setClickedWord,
    editingContent,
    setEditingContent,
    displayLineNumbers,
    syntaxHighlighting,
    setError,
    setSaveState,
    saveState,
    setPresenceUsers,
    setSelfClientId,
    setRemoteNotice,
    setConflict,
    connect = true,
    editorPatch,
}: CodeProps) {
    const [lastEdit, setLastEdit] = useState(new Date().getTime())
    const codeRef = useRef<HTMLPreElement>(null)
    const { sendEdit, sendCursor, sendEditing } = useShareCodeSocket({
        id,
        share,
        editingContent,
        setEditingContent,
        setError,
        setIsConnected,
        setParticipants,
        setShare,
        setPresenceUsers,
        setSelfClientId,
        setRemoteNotice,
        setConflict,
        onSaveStateChange: setSaveState,
        saveState,
        enabled: connect,
    })

    useEffect(() => {
        applyHighlightedCode(codeRef.current, editingContent, syntaxHighlighting)
    }, [editingContent, syntaxHighlighting])

    useEffect(() => {
        if (!editorPatch) {
            return
        }

        setEditingContent(editorPatch.value)
        applyHighlightedCode(codeRef.current, editorPatch.value, syntaxHighlighting)
        sendEdit(editorPatch.value)
    }, [editorPatch?.nonce])

    useEffect(() => {
        if (!codeRef.current) return

        const timeout = setTimeout(() => {
            if (!codeRef.current) {
                return
            }

            applyHighlightedCode(codeRef.current, editingContent, syntaxHighlighting)
        }, 1000)

        return () => clearTimeout(timeout)
    }, [lastEdit, share?.content, syntaxHighlighting])

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const value = e.target.value
        applyContentChange(value)
    }

    function applyContentChange(value: string) {
        setEditingContent(value)
        applyHighlightedCode(codeRef.current, value, syntaxHighlighting)
        setLastEdit(new Date().getTime())
        setSaveState('saving')
        sendEdit(value)
    }

    if (!share) {
        return (
            <main
                aria-busy='true'
                aria-label='Loading workspace editor'
                className='grid h-full w-full overflow-hidden rounded-lg border border-ui-border'
            >
                <div className='flex h-full min-h-0 w-full'>
                    <div className='hidden w-12 shrink-0 border-r border-ui-border bg-ui-raised p-2 sm:block'>
                        {Array.from({ length: 14 }).map((_, index) => (
                            <div key={index} className='mb-2 h-3 rounded bg-ui-border' />
                        ))}
                    </div>
                    <div className='min-w-0 flex-1 space-y-3 p-4'>
                        <div className='h-4 w-44 animate-pulse rounded bg-ui-border' />
                        <div className='h-3 w-11/12 animate-pulse rounded bg-ui-border' />
                        <div className='h-3 w-9/12 animate-pulse rounded bg-ui-border' />
                        <div className='h-3 w-10/12 animate-pulse rounded bg-ui-border' />
                        <div className='mt-5 h-3 w-7/12 animate-pulse rounded bg-ui-border' />
                        <div className='h-3 w-8/12 animate-pulse rounded bg-ui-border' />
                    </div>
                </div>
            </main>
        )
    }

    return (
        <Editor
            codeRef={codeRef}
            editingContent={editingContent}
            handleChange={handleChange}
            onCursorChange={sendCursor}
            onEditingChange={sendEditing}
            setClickedWord={setClickedWord}
            displayLineNumbers={displayLineNumbers}
            syntaxHighlighting={syntaxHighlighting}
            setError={setError}
            onInsertTemplate={applyContentChange}
        />
    )
}
