'use client'

import { useEffect, useState, useRef } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { getShare } from '@/utils/share/get'
import { updateShare } from '@/utils/share/put'

type Share = {
    id: string
    path: string
    content: string
    timestamp: string
}

type Props = {
    id: string
}

export default function SharePage({ id }: Props) {
    const [share, setShare] = useState<Share | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const codeRef = useRef<HTMLPreElement>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    async function fetchShare() {
        try {
            setLoading(true)
            const data = await getShare(id)
            if (!data) {
                setError('Share not found')
                setShare(null)
                return
            }
            setShare(data)
            setEditingContent(data.content)
            setError(null)
        } catch (err) {
            console.error('Error fetching share:', err)
            setError('Failed to load share')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchShare()
        const interval = setInterval(fetchShare, 1000)
        return () => clearInterval(interval)
    })

    useEffect(() => {
        if (codeRef.current) {
            hljs.highlightElement(codeRef.current)
        }
    }, [editingContent])

    async function saveContent(content: string) {
        if (!share) return
        try {
            await updateShare(share.id, { content })
        } catch (err) {
            console.error('Failed to save share:', err)
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const value = e.target.value
        setEditingContent(value)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => saveContent(value), 1000)
    }

    if (loading) {
        return <div className='p-6 text-gray-400'>Loading...</div>
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
                <span className='text-sm text-gray-400'>
                    Last updated: {new Date(share.timestamp).toLocaleString()}
                </span>
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
