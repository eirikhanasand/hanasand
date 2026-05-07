import { Dispatch, RefObject, SetStateAction, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { handleEditorKeyDown } from './editorKeybindings'
import { Braces, FileCode2, PanelsTopLeft, TerminalSquare } from 'lucide-react'

type EditorProps = {
    codeRef: RefObject<HTMLPreElement | null>
    editingContent: string
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    onCursorChange: (selectionStart: number, selectionEnd: number, content: string) => void
    onEditingChange: (editing: boolean) => void
    setClickedWord: (word: string) => void
    displayLineNumbers: boolean
    syntaxHighlighting: boolean
    setError: Dispatch<SetStateAction<string | boolean | null>>
    onInsertTemplate?: (value: string) => void
}

export default function Editor({
    codeRef,
    editingContent,
    handleChange,
    onCursorChange,
    onEditingChange,
    setClickedWord,
    displayLineNumbers,
    syntaxHighlighting,
    setError,
    onInsertTemplate,
}: EditorProps) {
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const lineNumberRef = useRef<HTMLElement | null>(null)
    const editingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [lineNumberWidth, setLineNumberWidth] = useState(0)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const searchParams = useSearchParams()
    const lines = editingContent.split(/\r?\n/)

    function handleWordClick(e: React.MouseEvent<HTMLTextAreaElement>) {
        const textarea = e.currentTarget
        const cursorPos = textarea.selectionStart
        setClickedWord(getTokenAtPosition(textarea.value, cursorPos))
    }

    function handleSelection(e: React.SyntheticEvent<HTMLTextAreaElement>) {
        const textarea = e.currentTarget
        const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim()
        onCursorChange(textarea.selectionStart, textarea.selectionEnd, textarea.value)
        if (selected) {
            setClickedWord(selected)
        }
    }

    function handleEditorChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        handleChange(e)
        onEditingChange(true)
        onCursorChange(e.currentTarget.selectionStart, e.currentTarget.selectionEnd, e.currentTarget.value)
        if (editingTimeoutRef.current) {
            clearTimeout(editingTimeoutRef.current)
        }
        editingTimeoutRef.current = setTimeout(() => onEditingChange(false), 1400)
    }

    function getTokenAtPosition(value: string, cursorPos: number) {
        const left = value.slice(0, cursorPos)
        const right = value.slice(cursorPos)
        const leftWord = left.match(/[A-Za-z_$][\w$-]*$/)?.[0] ?? ''
        const rightWord = right.match(/^[A-Za-z_$][\w$-]*/)?.[0] ?? ''
        return leftWord + rightWord
    }

    function handleScrollDiv(e: React.UIEvent<HTMLDivElement>) {
        if (codeRef.current) {
            const codePre = codeRef.current
            if (codePre) {
                codePre.scrollTop = e.currentTarget.scrollTop
                codePre.scrollLeft = e.currentTarget.scrollLeft
            }
            handleScroll(e)
        }
    }

    function handleScroll(e: React.UIEvent<HTMLDivElement | HTMLPreElement | HTMLTextAreaElement>) {
        const current = e.currentTarget

        document.querySelectorAll<HTMLElement>('.sync-scroll').forEach(el => {
            if (el !== current) {
                el.scrollTop = current.scrollTop
            }
        })
    }

    useEffect(() => {
        if (lineNumberRef.current) {
            setLineNumberWidth(lineNumberRef.current.offsetWidth)
        }
    }, [editingContent, syntaxHighlighting])

    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            e.preventDefault()
            setError('cmdw')
        }

        const hasUnsavedChanges = editingContent.trim().length > 0
        if (hasUnsavedChanges) {
            window.addEventListener('beforeunload', handleBeforeUnload)
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [editingContent])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        return () => {
            if (editingTimeoutRef.current) {
                clearTimeout(editingTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        const targetLine = Number(searchParams.get('line'))
        if (!targetLine || !inputRef.current) {
            return
        }

        const textarea = inputRef.current
        const lineHeight = 20
        const scrollTop = Math.max(targetLine - 6, 0) * lineHeight
        textarea.scrollTop = scrollTop
        if (codeRef.current) {
            codeRef.current.scrollTop = scrollTop
        }
        if (lineNumberRef.current) {
            lineNumberRef.current.scrollTop = scrollTop
        }

        const start = getLineOffset(editingContent, targetLine)
        textarea.setSelectionRange(start, start)
        textarea.focus()
    }, [codeRef, editingContent, searchParams])

    return (
        <main aria-label='Code editor' className='w-full h-full relative overflow-hidden outline outline-dark rounded-lg'>
            {editingContent.trim().length <= 0 && (
                <EmptyEditorState
                    displayLineNumbers={displayLineNumbers}
                    onInsertTemplate={onInsertTemplate}
                />
            )}
            <div className={'hljs relative w-full h-full flex'}>
                {displayLineNumbers && (
                    <div
                        // @ts-expect-error Not fully compatible because ref is
                        // element specific, but its close enough (<div> vs <pre>)
                        ref={lineNumberRef}
                        className={`sync-scroll min-w-fit select-none overflow-auto pl-2 pr-3 pt-2 text-right font-mono text-sm leading-5 text-bright/34 noscroll ${lines.length > 100 ? 'pb-[100vh]' : ''}`}
                        onScroll={handleScrollDiv}
                    >
                        {lines.map((_, i) => (
                            <div key={i} className='h-5 leading-5'>
                                {i + 1}
                            </div>
                        ))}
                    </div>
                )}

                <pre className={`sync-scroll m-0 overflow-auto pt-2 font-mono text-sm leading-5 ${lines.length > 100 ? 'pb-[100vh]' : ''}`}>
                    <code ref={codeRef}>{editingContent}</code>
                </pre>
            </div>
            <textarea
                ref={inputRef}
                aria-label='Workspace editor'
                value={editingContent}
                onChange={handleEditorChange}
                onClick={handleWordClick}
                onSelect={handleSelection}
                onKeyUp={(e) => onCursorChange(e.currentTarget.selectionStart, e.currentTarget.selectionEnd, e.currentTarget.value)}
                onScroll={(e) => {
                    const lineNumbers = lineNumberRef.current
                    if (lineNumbers) {
                        lineNumbers.scrollTop = e.currentTarget.scrollTop
                        handleScroll(e)
                    }
                }}
                className={`sync-scroll absolute left-0 top-0 z-10 min-h-full min-w-full resize-none overflow-auto rounded-lg bg-transparent pt-2 font-mono text-sm leading-5 text-transparent caret-gray-200 outline-none ${lines.length > 100 ? 'pb-[100vh]' : ''}`}
                autoCapitalize='off'
                autoComplete='off'
                autoCorrect='off'
                spellCheck={false}
                style={{
                    paddingLeft: displayLineNumbers ? `${lineNumberWidth}px` : '0px',
                    whiteSpace: 'pre',
                    overflowWrap: 'normal',
                }}
                onKeyDown={(event) => handleEditorKeyDown({
                    event,
                    editingContent,
                    handleChange,
                    history,
                    historyIndex,
                    setHistory,
                    setHistoryIndex
                })}
            />
        </main>
    )
}

function EmptyEditorState({
    displayLineNumbers,
    onInsertTemplate,
}: {
    displayLineNumbers: boolean
    onInsertTemplate?: (value: string) => void
}) {
    const insetForLeftRail = displayLineNumbers ? 'pl-24 sm:pl-14' : 'pl-20 sm:pl-4'

    return (
        <div className={`pointer-events-none absolute inset-0 z-20 flex items-start ${insetForLeftRail} pr-3 pt-3`}>
            <div className='pointer-events-auto w-full max-w-2xl rounded-xl border border-bright/10 bg-background/72 p-3 shadow-2xl shadow-black/20 backdrop-blur-md'>
                <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <h2 className='text-sm font-medium text-bright/82'>Empty editor</h2>
                        <p className='mt-1 text-xs leading-5 text-bright/42'>Type here to edit the selected item, or choose a starter below.</p>
                    </div>
                    <FileCode2 className='h-4 w-4 shrink-0 text-[#f07d33]' />
                </div>
                <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                    {starterTemplates.map((template) => {
                        const Icon = template.icon

                        return (
                            <button
                                key={template.label}
                                type='button'
                                onClick={() => onInsertTemplate?.(template.content)}
                                className='group flex min-h-11 items-center gap-2 rounded-lg border border-bright/8 bg-bright/[0.035] px-3 text-left transition hover:border-[#f07d33]/32 hover:bg-[#f07d33]/8'
                            >
                                <Icon className='h-4 w-4 shrink-0 text-bright/42 transition group-hover:text-[#f07d33]' />
                                <span className='min-w-0 truncate text-xs font-medium text-bright/68 group-hover:text-bright/86'>{template.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const starterTemplates = [
    {
        label: 'Minimal page',
        icon: PanelsTopLeft,
        content: `export default function Page() {
    return (
        <main>
            <h1>Hanasand</h1>
        </main>
    )
}
`,
    },
    {
        label: 'API handler',
        icon: Braces,
        content: `export async function GET() {
    return Response.json({ ok: true })
}
`,
    },
    {
        label: 'Runbook',
        icon: TerminalSquare,
        content: `# Runbook

## Check

## Fix

## Verify
`,
    },
    {
        label: 'Blank markdown',
        icon: FileCode2,
        content: `# Notes

`,
    },
]

function getLineOffset(value: string, line: number) {
    if (line <= 1) {
        return 0
    }

    let offset = 0
    let currentLine = 1
    while (currentLine < line && offset < value.length) {
        const next = value.indexOf('\n', offset)
        if (next < 0) {
            return value.length
        }
        offset = next + 1
        currentLine += 1
    }

    return offset
}
