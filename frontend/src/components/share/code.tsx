'use client'

import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import '@styles/github.css'
import Editor from '@/components/share/editor'
import { applyHighlightedCode } from './codeUtils'
import { useShareCodeSocket } from './useShareCodeSocket'

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
    setError
}: CodeProps) {
    const [lastEdit, setLastEdit] = useState(new Date().getTime())
    const codeRef = useRef<HTMLPreElement>(null)
    const { sendEdit } = useShareCodeSocket({
        id,
        share,
        editingContent,
        setEditingContent,
        setError,
        setIsConnected,
        setParticipants,
        setShare,
    })

    useEffect(() => {
        applyHighlightedCode(codeRef.current, editingContent, syntaxHighlighting)
    }, [editingContent, syntaxHighlighting])

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
        setEditingContent(value)
        applyHighlightedCode(codeRef.current, value, syntaxHighlighting)
        setLastEdit(new Date().getTime())
        sendEdit(value)
    }

    if (!share) {
        return null
    }

    return (
        <Editor
            codeRef={codeRef}
            editingContent={editingContent}
            handleChange={handleChange}
            setClickedWord={setClickedWord}
            displayLineNumbers={displayLineNumbers}
            syntaxHighlighting={syntaxHighlighting}
            setError={setError}
        />
    )
}
