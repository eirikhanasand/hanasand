import { ChangeEvent, Dispatch, RefObject, SetStateAction, useState } from 'react'

type EditorProps = {
    codeRef: RefObject<HTMLPreElement | null>
    editingContent: string
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    setClickedWord: (word: string) => void
}

type HandleKeyDownProps = {
    e: React.KeyboardEvent<HTMLTextAreaElement>
    handleChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
    editingContent: string
    history: string[]
    setHistory: Dispatch<SetStateAction<string[]>>
    historyIndex: number
    setHistoryIndex: Dispatch<SetStateAction<number>>
}

export default function Editor({ codeRef, editingContent, handleChange, setClickedWord }: EditorProps) {
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)

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

    return (
        <main className="flex-1 relative overflow-hidden">
            <h1 className='absolute top-2 left-2 z-50 pointer-events-none select-none text-gray-500'>
                {editingContent.trim().length <= 0 && 'Hello world...'}
            </h1>
            <div className="relative w-full h-full">
                <pre
                    ref={codeRef}
                    className="hljs w-full h-full overflow-auto p-2 text-sm font-mono absolute top-0 left-0 m-0"
                    style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                    onScroll={(e) => {
                        const textarea = e.currentTarget.nextSibling as HTMLTextAreaElement | null
                        if (textarea) textarea.scrollTop = e.currentTarget.scrollTop
                        if (textarea) textarea.scrollLeft = e.currentTarget.scrollLeft
                    }}
                >
                    <code>{editingContent}</code>
                </pre>

                <textarea
                    value={editingContent}
                    onChange={handleChange}
                    onClick={handleWordClick}
                    className="w-full h-full bg-transparent text-transparent resize-none rounded-lg p-2 text-sm font-mono outline-none caret-white relative z-10"
                    style={{
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        overflow: 'auto',
                    }}
                    onKeyDown={(e) => HandleKeyDown({
                        e,
                        handleChange,
                        editingContent, 
                        history,
                        setHistory,
                        historyIndex,
                        setHistoryIndex
                    })}
                    onScroll={(e) => {
                        const pre = e.currentTarget.previousSibling as HTMLTextAreaElement | null
                        if (pre) pre.scrollTop = e.currentTarget.scrollTop
                        if (pre) pre.scrollLeft = e.currentTarget.scrollLeft
                    }}
                />
            </div>
        </main>
    )
}

function HandleKeyDown({
    e,
    handleChange,
    editingContent,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex
}: HandleKeyDownProps) {
    function handleChangeWithHistory(newValue: string) {
        const updatedHistory = history.slice(0, historyIndex + 1)
        setHistory([...updatedHistory, newValue])
        setHistoryIndex(updatedHistory.length)
        handleChange({ target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>)
    }

    function handleUndo() {
        if (historyIndex > 0) {
            const prev = history[historyIndex - 1]
            setHistoryIndex(historyIndex - 1)
            handleChange({ target: { value: prev } } as React.ChangeEvent<HTMLTextAreaElement>)
        }
    }

    function handleRedo() {
        if (historyIndex < history.length - 1) {
            const next = history[historyIndex + 1]
            setHistoryIndex(historyIndex + 1)
            handleChange({ target: { value: next } } as React.ChangeEvent<HTMLTextAreaElement>)
        }
    }

    const textarea = e.currentTarget
    if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = editingContent.substring(0, start) + '    ' + editingContent.substring(end)
        handleChangeWithHistory(newValue)
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 4
        }, 0)
    }

    if (
        (e.key === '7' && (e.metaKey || e.ctrlKey) && e.shiftKey)
    ) {
        e.preventDefault()
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const value = editingContent
        const startLine = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1
        const endLine = value.indexOf('\n', textarea.selectionEnd)
        const adjustedEnd = endLine === -1 ? value.length : endLine
        const selection = value.substring(startLine, adjustedEnd)
        const before = value.substring(0, startLine)
        const after = value.substring(adjustedEnd)
        const lines = selection.split('\n')
        const commentedLines = lines.map((line) => {
            if (line.trimStart().startsWith('//')) return line.slice(3)
            return '// ' + line
        })

        const newValue = before + commentedLines.join('\n') + after

        handleChangeWithHistory(newValue)

        setTimeout(() => {
            textarea.selectionStart = start
            textarea.selectionEnd = end + 2 * lines.length
        }, 0)
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault()
        handleRedo()
    }
}
