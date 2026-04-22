import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'

type TerminalViewerProps = {
    open: boolean
    share: Share
    chunks: string[]
    isDone?: boolean
    sendInput: (message: string) => { status: boolean, message?: string }
    sendResize: (cols: number, rows: number) => void
}

export default function TerminalViewer({ open, share, chunks, sendInput, sendResize }: TerminalViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const renderedChunkCountRef = useRef(0)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)

    useEffect(() => {
        if (!containerRef.current || terminalRef.current) {
            return
        }

        const term = new Terminal({
            cursorBlink: true,
            convertEol: false,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
            fontSize: 14,
            lineHeight: 1.35,
            theme: {
                background: '#11130f',
                foreground: '#edf1e9',
                cursor: '#9de18f',
                selectionBackground: 'rgba(157, 225, 143, 0.24)'
            }
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(containerRef.current)

        terminalRef.current = term
        fitAddonRef.current = fitAddon
        ;(window as Window & {
            __shareTerminal?: Terminal
            __shareTerminalSendInput?: (content: string) => void
        }).__shareTerminal = term
        ;(window as Window & {
            __shareTerminal?: Terminal
            __shareTerminalSendInput?: (content: string) => void
        }).__shareTerminalSendInput = (content: string) => {
            sendInput(content)
        }

        const syncSize = () => {
            if (!fitAddonRef.current || !terminalRef.current) {
                return
            }

            fitAddonRef.current.fit()
            sendResize(terminalRef.current.cols, terminalRef.current.rows)
        }

        const inputDisposable = term.onData((data) => {
            sendInput(data)
        })

        const focusTimeout = window.setTimeout(() => {
            syncSize()
            term.focus()
        }, 50)

        resizeObserverRef.current = new ResizeObserver(() => {
            syncSize()
        })
        resizeObserverRef.current.observe(containerRef.current)

        return () => {
            window.clearTimeout(focusTimeout)
            resizeObserverRef.current?.disconnect()
            resizeObserverRef.current = null
            inputDisposable.dispose()
            term.dispose()
            terminalRef.current = null
            fitAddonRef.current = null
            delete (window as Window & {
                __shareTerminal?: Terminal
                __shareTerminalSendInput?: (content: string) => void
            }).__shareTerminal
            delete (window as Window & {
                __shareTerminal?: Terminal
                __shareTerminalSendInput?: (content: string) => void
            }).__shareTerminalSendInput
        }
    }, [sendInput, sendResize])

    useEffect(() => {
        if (!terminalRef.current) {
            return
        }

        terminalRef.current.reset()
        renderedChunkCountRef.current = 0
    }, [share.id])

    useEffect(() => {
        if (!terminalRef.current) {
            return
        }

        const nextChunks = chunks.slice(renderedChunkCountRef.current)
        nextChunks.forEach((chunk) => {
            try {
                const parsed = JSON.parse(chunk) as { content?: string }
                terminalRef.current?.write(parsed.content || '')
            } catch {
                terminalRef.current?.write(chunk)
            }
        })
        renderedChunkCountRef.current = chunks.length
    }, [chunks, share.id])

    useEffect(() => {
        if (!open || !terminalRef.current) {
            return
        }

        const timeout = window.setTimeout(() => {
            fitAddonRef.current?.fit()
            terminalRef.current?.focus()
            sendResize(terminalRef.current?.cols || 80, terminalRef.current?.rows || 24)
        }, 200)

        return () => window.clearTimeout(timeout)
    }, [open, sendResize])

    return (
        <div
            ref={containerRef}
            onClick={() => terminalRef.current?.focus()}
            className='h-full w-full rounded-md bg-[#11130f] px-2 py-1'
            data-share-terminal={share.alias}
            data-testid="share-terminal-xterm"
        />
    )
}
