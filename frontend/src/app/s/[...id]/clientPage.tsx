'use client'

import { useEffect, useState, useRef } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { getShare } from '@/utils/share/get'
import config from '@/config'
import Header from '@/components/s/header'
import Editor from '@/components/s/editor'

type Share = {
    id: string
    path: string
    content: string
    timestamp: string
}

export default function SharePageClient({ id }: { id: string }) {
    const [share, setShare] = useState<Share | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
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

    // WebSocket setup
    useEffect(() => {
        if (!share) return

        const ws = new WebSocket(`${config.url.cdn_ws}/share/ws/${share.id}`)
        wsRef.current = ws

        ws.onopen = () => {
            setIsConnected(true)
        }

        ws.onclose = () => {
            setIsConnected(false)
        }

        ws.onerror = (err) => {
            console.error('WebSocket error:', err)
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
    }, [id, share])

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const value = e.target.value
        setEditingContent(value)

        if (codeRef.current) {
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

        setEditingContent(value)
        sendUpdate()
    }

    if (error) {
        return <div className='p-6 text-red-500'>{error}</div>
    }

    if (!share) {
        return null
    }

    return (
        <div className='flex flex-col h-screen w-screen bg-[#1e1e1e] text-white'>
            <Header share={share} isConnected={isConnected} participants={participants} />
            <Editor codeRef={codeRef} editingContent={editingContent} handleChange={handleChange} />
        </div>
    )
}
