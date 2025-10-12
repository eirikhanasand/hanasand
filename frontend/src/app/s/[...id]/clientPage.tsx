'use client'

import { useEffect, useState, useRef } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { getShare } from '@/utils/share/get'
import config from '@/config'

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
    const [lastSaved, setLastSaved] = useState<number>(0)
    const codeRef = useRef<HTMLPreElement>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

    // Syntax highlighting
    useEffect(() => {
        if (codeRef.current) {
            hljs.highlightElement(codeRef.current)
        }
    }, [editingContent])

    // WebSocket setup
    useEffect(() => {
        if (!share) return

        const ws = new WebSocket(`${config.url.api_ws}/share/${share.id}`)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('✅ Connected to WebSocket')
            setIsConnected(true)
        }

        ws.onclose = () => {
            console.log('❌ Disconnected from WebSocket')
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
                    setEditingContent(msg.content)
                    setShare((prev) => prev ? { ...prev, timestamp: msg.timestamp } : prev)
                }
            } catch (err) {
                console.error('Invalid message from server:', err)
            }
        }

        return () => {
            ws.close()
        }
    }, [share?.id])

    // Handle local edits
    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const value = e.target.value
        setEditingContent(value)

        // Local highlighting refresh
        if (codeRef.current) hljs.highlightElement(codeRef.current)

        // Throttle sends to 5s intervals
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        const now = Date.now()
        const timeSinceLastSave = now - lastSaved

        const sendUpdate = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'edit',
                    id: share?.id,
                    content: value,
                }))
                setLastSaved(Date.now())
            }
        }

        if (timeSinceLastSave >= 5000) {
            sendUpdate()
        } else {
            const delay = 5000 - timeSinceLastSave
            saveTimeoutRef.current = setTimeout(sendUpdate, delay)
        }
    }

    if (error) {
        return <div className='p-6 text-red-500'>{error}</div>
    }

    if (!share) {
        return null
    }

    return (
        <div className='flex flex-col h-screen w-screen bg-[#1e1e1e] text-white'>
            <header className='bg-[#2d2d2d] p-4 flex justify-between items-center shadow-md'>
                <h1 className='font-semibold text-lg'>{share.path}</h1>
                <div className='flex items-center gap-4'>
                    <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                    </span>
                    <span className='text-sm text-gray-400'>
                        Last updated: {new Date(share.timestamp).toLocaleString()}
                    </span>
                </div>
            </header>

            <main className='flex-1 overflow-auto p-6 relative'>
                {/* Pre for syntax highlighting */}
                <pre
                    ref={codeRef}
                    className='hljs w-full rounded-lg p-4 bg-[#1e1e1e] overflow-auto text-sm pointer-events-none absolute top-0 left-0'
                >
                    <code>{editingContent}</code>
                </pre>

                {/* Editable textarea */}
                <textarea
                    value={editingContent}
                    onChange={handleChange}
                    className='w-full h-full bg-transparent text-white resize-none rounded-lg p-4 text-sm font-mono outline-none caret-white relative z-10'
                />
            </main>
        </div>
    )
}
