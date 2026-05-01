import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useRef } from 'react'

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
    const fitTimeoutRef = useRef<number | null>(null)
    const lastSizeRef = useRef({ cols: 0, rows: 0 })

    const clearScheduledFit = useCallback(() => {
        if (fitTimeoutRef.current === null) {
            return
        }

        window.clearTimeout(fitTimeoutRef.current)
        fitTimeoutRef.current = null
    }, [])

    const scheduleFit = useCallback((focus = false, delay = 0) => {
        clearScheduledFit()
        fitTimeoutRef.current = window.setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitTimeoutRef.current = null

                const container = containerRef.current
                const terminal = terminalRef.current
                const fitAddon = fitAddonRef.current
                if (!container || !terminal || !fitAddon) {
                    return
                }

                const { height, width } = container.getBoundingClientRect()
                if (width < 80 || height < 40) {
                    return
                }

                try {
                    fitAddon.fit()
                    if (focus) {
                        terminal.focus()
                    }

                    const nextSize = { cols: terminal.cols, rows: terminal.rows }
                    if (nextSize.cols !== lastSizeRef.current.cols || nextSize.rows !== lastSizeRef.current.rows) {
                        lastSizeRef.current = nextSize
                        sendResize(nextSize.cols, nextSize.rows)
                    }
                } catch {
                    // xterm can briefly be unmeasurable while the panel/browser is hidden.
                }
            })
        }, delay)
    }, [clearScheduledFit, sendResize])

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

        const inputDisposable = term.onData((data) => {
            sendInput(data)
        })

        const refit = () => scheduleFit()
        const refitWithFocus = () => scheduleFit(true, 50)
        const refitWhenVisible = () => {
            if (document.visibilityState === 'visible') {
                scheduleFit(true, 80)
            }
        }

        resizeObserverRef.current = new ResizeObserver(() => {
            scheduleFit()
        })
        resizeObserverRef.current.observe(containerRef.current)
        window.addEventListener('focus', refitWithFocus)
        window.addEventListener('pageshow', refitWithFocus)
        window.addEventListener('resize', refit)
        document.addEventListener('visibilitychange', refitWhenVisible)
        scheduleFit(true, 80)

        return () => {
            clearScheduledFit()
            resizeObserverRef.current?.disconnect()
            resizeObserverRef.current = null
            window.removeEventListener('focus', refitWithFocus)
            window.removeEventListener('pageshow', refitWithFocus)
            window.removeEventListener('resize', refit)
            document.removeEventListener('visibilitychange', refitWhenVisible)
            inputDisposable.dispose()
            term.dispose()
            terminalRef.current = null
            fitAddonRef.current = null
            lastSizeRef.current = { cols: 0, rows: 0 }
            delete (window as Window & {
                __shareTerminal?: Terminal
                __shareTerminalSendInput?: (content: string) => void
            }).__shareTerminal
            delete (window as Window & {
                __shareTerminal?: Terminal
                __shareTerminalSendInput?: (content: string) => void
            }).__shareTerminalSendInput
        }
    }, [clearScheduledFit, scheduleFit, sendInput])

    useEffect(() => {
        if (!terminalRef.current) {
            return
        }

        terminalRef.current.reset()
        renderedChunkCountRef.current = 0
        scheduleFit()
    }, [scheduleFit, share.id])

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

        scheduleFit(true, 200)
    }, [open, scheduleFit])

    return (
        <div
            ref={containerRef}
            onClick={() => terminalRef.current?.focus()}
            className='h-full min-w-0 w-full overflow-hidden rounded-md bg-[#11130f]'
            data-share-terminal={share.alias}
            data-testid='share-terminal-xterm'
        />
    )
}
