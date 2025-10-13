'use client'

import { useEffect, useState, useRef, Dispatch, SetStateAction } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { getShare } from '@/utils/share/get'
import config from '@/config'
import Editor from '@/components/s/editor'

type Share = {
    id: string
    path: string
    content: string
    timestamp: string
}

type CodeProps = {
    id: string
    setParticipants: Dispatch<SetStateAction<number>>
    isConnected: boolean
    setIsConnected: Dispatch<SetStateAction<boolean>>
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    setClickedWord: Dispatch<SetStateAction<string | null>>
}

export default function Code({ id, setParticipants, isConnected, setIsConnected, share, setShare, setClickedWord }: CodeProps) {
    const [error, setError] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [reconnect, setReconnect] = useState(false)
    const [lastEdit, setLastEdit] = useState(new Date().getTime())
    const codeRef = useRef<HTMLPreElement>(null)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        async function fetchShare() {
            try {
                const data = await getShare(id)
                if (!data) {
                    setError('Share not found')
                    return
                }
                setShare(data)
                setEditingContent(data.content)
            } catch (err) {
                console.error('Error fetching share:', err)
                setError('Failed to load share')
            }
        }
        fetchShare()
    }, [id])

    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.removeAttribute('data-highlighted')
            codeRef.current.textContent = editingContent
            hljs.highlightElement(codeRef.current)
        }
    }, [editingContent])

    useEffect(() => {
        if (!codeRef.current) return

        const timeout = setTimeout(() => {
            if (!codeRef.current) {
                return
            }
            console.log("rehighlighting")
            codeRef.current.removeAttribute('data-highlighted')
            codeRef.current.textContent = editingContent
            hljs.highlightElement(codeRef.current)
        }, 1000)

        return () => clearTimeout(timeout)
    }, [lastEdit, share?.content])

    useEffect(() => {
        if (!share) return

        const ws = new WebSocket(`${config.url.cdn_ws}/share/ws/${share.id}`)
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
            } catch (err) {
                console.error('Invalid message from server:', err)
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
            codeRef.current.textContent = editingContent
            hljs.highlightElement(codeRef.current)
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

    if (error) {
        return <div className='p-6 text-red-500'>{error}</div>
    }

    if (!share) {
        return null
    }

    return <Editor
        codeRef={codeRef}
        editingContent={editingContent}
        handleChange={handleChange}
        setClickedWord={setClickedWord}
    />
}
