'use client'

import { useEffect, useState, useRef, Dispatch, SetStateAction } from 'react'
import hljs from 'highlight.js'
import '@styles/github.css'
import { getShare } from '@/utils/share/get'
import config from '@/config'
import Editor from '@/components/share/editor'
import { getCookie } from '@/utils/cookies'

type CodeProps = {
    id: string
    setParticipants: Dispatch<SetStateAction<number>>
    isConnected: boolean
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
    isConnected,
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
    const [reconnect, setReconnect] = useState(false)
    const [lastEdit, setLastEdit] = useState(new Date().getTime())
    const codeRef = useRef<HTMLPreElement>(null)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        async function fetchShare() {
            try {
                const userId = getCookie('id') ?? undefined
                const token = getCookie('access_token') ?? undefined
                const data = await getShare({ id, token, userId })
                if (typeof data === 'string') {
                    setError(data)
                    return
                }

                setError(null)
                setShare(data)
                setEditingContent(data.content)
            } catch (error) {
                console.error(`Error fetching share: ${error}`)
                setError('Failed to load share')
            }
        }

        fetchShare()
    }, [id, setEditingContent])

    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.removeAttribute('data-highlighted')
            if (syntaxHighlighting) {
                codeRef.current.textContent = editingContent
                hljs.highlightElement(codeRef.current)
            } else {
                codeRef.current.innerText = editingContent
            }
        }
    }, [editingContent, syntaxHighlighting])

    useEffect(() => {
        if (!codeRef.current) return

        const timeout = setTimeout(() => {
            if (!codeRef.current) {
                return
            }

            codeRef.current.removeAttribute('data-highlighted')
            if (syntaxHighlighting) {
                codeRef.current.textContent = editingContent
                hljs.highlightElement(codeRef.current)
            } else {
                codeRef.current.innerText = editingContent
            }
        }, 1000)

        return () => clearTimeout(timeout)
    }, [lastEdit, share?.content, syntaxHighlighting])

    useEffect(() => {
        if (!share) return

        const ws = new WebSocket(`${config.url.cdn_ws}/share/${share.id}`)
        wsRef.current = ws

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)
        }

        ws.onclose = () => {
            setIsConnected(false)
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
            setIsConnected(false)
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.type === 'update' && msg.content !== editingContent) {
                    setParticipants(msg.participants)
                    setEditingContent(msg.content)
                    setShare((prev) => prev ? { ...prev, timestamp: msg.timestamp } : prev)
                }

                if (msg.type === 'join') {
                    setParticipants(msg.participants)
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            ws.close()
        }
    }, [id, share, reconnect])

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        if (!isConnected) {
            setReconnect(true)
        }

        const value = e.target.value
        setEditingContent(value)

        if (codeRef.current) {
            codeRef.current.removeAttribute('data-highlighted')
            if (syntaxHighlighting) {
                codeRef.current.textContent = editingContent
                hljs.highlightElement(codeRef.current)
            } else {
                codeRef.current.innerText = editingContent
            }
        }

        function sendUpdate() {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'edit',
                    id: share?.id,
                    content: value,
                }))
            }
        }

        setLastEdit(new Date().getTime())
        setEditingContent(value)
        sendUpdate()
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
