import { RefObject } from 'react'

type EditorProps = {
    codeRef: RefObject<HTMLPreElement | null>
    editingContent: string
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

export default function Editor({codeRef, editingContent, handleChange}: EditorProps) {
    return (
        <main className="flex-1 relative overflow-hidden">
            <div className="relative w-full h-full">
                <pre
                    ref={codeRef}
                    className="hljs w-full h-full rounded-lg bg-[#1e1e1e] overflow-auto p-2 text-sm font-mono absolute top-0 left-0 m-0"
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
                    className="w-full h-full bg-transparent text-transparent resize-none rounded-lg p-2 text-sm font-mono outline-none caret-white relative z-10"
                    style={{
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        overflow: 'auto',
                    }}
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
