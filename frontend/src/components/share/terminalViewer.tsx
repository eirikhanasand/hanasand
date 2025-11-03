import { useEffect, useRef, useMemo, useState, KeyboardEvent } from 'react'

type TerminalViewerProps = {
    text: string[]
    isDone?: boolean
    sendMessage: (message: string) => { status: boolean, message?: string }
}

export default function ConsoleViewer({ text, isDone, sendMessage }: TerminalViewerProps) {
    const containerRef = useRef<HTMLPreElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [input, setInput] = useState<string | null>(null)
    const [lines, setLines] = useState<string[]>(text)
    const [caretPos, setCaretPos] = useState({ top: 0, left: 0 })
    const hostname = 'root@root$'
    const spaces = ' '.repeat(hostname.length)
    const processed = useMemo(() => {
        const result: string[] = []

        for (const line of lines) {
            if (line.includes('running (') && line.includes('default')) {
                if (result.length && result[result.length - 1].includes('running (')) {
                    result[result.length - 1] = line
                } else {
                    result.push(line)
                }
            } else {
                result.push(line)
            }
        }

        return result
    }, [text, lines])

    function updateCaret() {
        const textarea = inputRef.current
        if (!textarea) return
        const selectionStart = textarea.selectionStart
        const textBeforeCursor = textarea.value.slice(0, selectionStart)
        const lines = textBeforeCursor.split('\n')
        const line = lines[lines.length - 1]
        const fontSize = 16
        const lineHeight = 20

        setCaretPos({
            top: (lines.length - 1) * lineHeight,
            left: line.length * (fontSize * 0.54)
        })
    }

    function handleContainerClick() {
        inputRef.current?.focus()
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey && input?.length) {
            e.preventDefault()
            const { message } = sendMessage(input)
            setLines(prev => [...prev, `${hostname} ${input}`])
            if (message) {
                setLines(prev => [...prev, `Error: ${message}`])
            }

            setInput('')
        }
    }

    useEffect(() => {
        updateCaret()
    }, [input])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const shouldScroll = el.scrollTop + el.clientHeight >= el.scrollHeight - (isDone ? 1000 : 200)
        if (shouldScroll) el.scrollTop = el.scrollHeight
    }, [processed, isDone])

    return (
        <div onClick={handleContainerClick} className='h-full flex flex-col'>
            {processed.length > 0 && <pre
                ref={containerRef}
                className={`rounded-md h-fit overflow-auto text-gray-300/50`}
            >
                {processed.join('\n')}
            </pre>}
            <div className={`flex justify-center items-center mt-1 gap-2 ${!processed.length ? 'h-full' : 'h-fit'} relative`}>
                <h1 className='h-full absolute top-0 left-0 text-green-500'>{hostname}</h1>
                <textarea
                    ref={inputRef}
                    value={spaces + (input || '')}
                    onChange={(e) => setInput(e.target.value.slice(hostname.length))}
                    className='w-full h-full outline-none caret-transparent resize-none'
                    onKeyDown={handleKeyDown}
                />
                <div className='bg-green-400 absolute pointer-events-none'
                    style={{
                        top: caretPos.top,
                        left: caretPos.left,
                        width: 8,
                        height: 20,
                        animation: 'blink 1s step-start infinite',
                    }}
                />
            </div>
        </div>
    )
}
