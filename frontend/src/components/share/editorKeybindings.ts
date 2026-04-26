import type { ChangeEvent, Dispatch, KeyboardEvent, SetStateAction } from 'react'

type HandleEditorKeyDownProps = {
    event: KeyboardEvent<HTMLTextAreaElement>
    editingContent: string
    handleChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
    history: string[]
    historyIndex: number
    setHistory: Dispatch<SetStateAction<string[]>>
    setHistoryIndex: Dispatch<SetStateAction<number>>
}

export function handleEditorKeyDown({
    event,
    editingContent,
    handleChange,
    history,
    historyIndex,
    setHistory,
    setHistoryIndex,
}: HandleEditorKeyDownProps) {
    const textarea = event.currentTarget

    function commitChange(newValue: string) {
        const updatedHistory = history.slice(0, historyIndex + 1)
        setHistory([...updatedHistory, newValue])
        setHistoryIndex(updatedHistory.length)
        handleChange({ target: { value: newValue } } as ChangeEvent<HTMLTextAreaElement>)
    }

    function undo() {
        if (historyIndex > 0) {
            const previousValue = history[historyIndex - 1]
            setHistoryIndex(historyIndex - 1)
            handleChange({ target: { value: previousValue } } as ChangeEvent<HTMLTextAreaElement>)
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            const nextValue = history[historyIndex + 1]
            setHistoryIndex(historyIndex + 1)
            handleChange({ target: { value: nextValue } } as ChangeEvent<HTMLTextAreaElement>)
        }
    }

    if (event.key === 'Tab') {
        event.preventDefault()
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = editingContent.substring(0, start) + '    ' + editingContent.substring(end)
        commitChange(newValue)
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 4
        }, 0)
        return
    }

    if (event.key === 'Ω' || (event.altKey && event.key === 'w')) {
        event.preventDefault()
        return
    }

    if (event.key === '7' && (event.metaKey || event.ctrlKey) && event.shiftKey) {
        event.preventDefault()
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const startLine = editingContent.lastIndexOf('\n', textarea.selectionStart - 1) + 1
        const endLine = editingContent.indexOf('\n', textarea.selectionEnd)
        const adjustedEnd = endLine === -1 ? editingContent.length : endLine
        const selection = editingContent.substring(startLine, adjustedEnd)
        const before = editingContent.substring(0, startLine)
        const after = editingContent.substring(adjustedEnd)
        const selectedLines = selection.split('\n')
        const commentedLines = selectedLines.map((line) => {
            if (line.trimStart().startsWith('//')) {
                return line.slice(3)
            }

            return `// ${line}`
        })

        commitChange(before + commentedLines.join('\n') + after)

        setTimeout(() => {
            textarea.selectionStart = start
            textarea.selectionEnd = end + 2 * selectedLines.length
        }, 0)
        return
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault()
        undo()
        return
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'Z'))) {
        event.preventDefault()
        redo()
    }
}
