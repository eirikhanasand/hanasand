import { Dispatch, RefObject, SetStateAction, useEffect, useRef, useState } from 'react'
import { handleEditorKeyDown } from './editorKeybindings'

type EditorProps = {
    codeRef: RefObject<HTMLPreElement | null>
    editingContent: string
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    setClickedWord: (word: string) => void
    displayLineNumbers: boolean
    syntaxHighlighting: boolean
    setError: Dispatch<SetStateAction<string | boolean | null>>
}

export default function Editor({
    codeRef,
    editingContent,
    handleChange,
    setClickedWord,
    displayLineNumbers,
    syntaxHighlighting,
    setError
}: EditorProps) {
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const lineNumberRef = useRef<HTMLElement | null>(null)
    const [lineNumberWidth, setLineNumberWidth] = useState(0)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const lines = editingContent.split(/\r?\n/)

    function handleWordClick(e: React.MouseEvent<HTMLTextAreaElement>) {
        const textarea = e.currentTarget
        const cursorPos = textarea.selectionStart
        const value = textarea.value
        const left = value.slice(0, cursorPos)
        const right = value.slice(cursorPos)
        const leftWord = left.split(/\s/).pop() ?? ''
        const rightWord = right.split(/\s/)[0] ?? ''
        const word = leftWord + rightWord
        setClickedWord(word)
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

    return (
        <main className='w-full h-full relative overflow-hidden outline outline-dark rounded-lg'>
            <h1 className={`absolute top-[6.7px] z-50 left-4 ${displayLineNumbers && 'pl-4'} pointer-events-none select-none text-gray-500`}>
                {editingContent.trim().length <= 0 && 'Hello world...'}
            </h1>
            <div className={'hljs relative w-full h-full flex'}>
                {displayLineNumbers && (
                    <div
                        // @ts-expect-error Not fully compatible because ref is
                        // element specific, but its close enough (<div> vs <pre>)
                        ref={lineNumberRef}
                        className={`min-w-fit sync-scroll select-none text-gray-500 text-right pl-2 overflow-auto pt-2 noscroll ${lines.length > 100 ? 'pb-[100vh]' : ''}`}
                        onScroll={handleScrollDiv}
                    >
                        {lines.map((_, i) => (
                            <h1 key={i} className='text-sm' style={{ color: 'var(--text-foreground)', opacity: 0.5 }}>
                                {i + 1}
                            </h1>
                        ))}
                    </div>
                )}

                <pre className={`sync-scroll -mt-[6px] overflow-auto text-sm font-mono ${lines.length > 100 ? 'pb-[100vh]' : ''}`}>
                    <code ref={codeRef}>{editingContent}</code>
                </pre>
            </div>
            <textarea
                ref={inputRef}
                value={editingContent}
                onChange={handleChange}
                onClick={handleWordClick}
                onScroll={(e) => {
                    const lineNumbers = lineNumberRef.current
                    if (lineNumbers) {
                        lineNumbers.scrollTop = e.currentTarget.scrollTop
                        handleScroll(e)
                    }
                }}
                className={`sync-scroll min-w-full min-h-full bg-transparent text-transparent resize-none rounded-lg pt-2 mr-2 text-sm font-mono overflow-auto outline-none caret-gray-200 absolute z-10 top-0 left-0 ${lines.length > 100 ? 'pb-[100vh]' : ''}`}
                style={{
                    paddingLeft: displayLineNumbers ? `${lineNumberWidth + 14}px` : '14px',
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
