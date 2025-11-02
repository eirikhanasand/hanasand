import { useEffect, useRef, useMemo } from 'react'

export default function ConsoleViewer({ text, isDone }: { text: string[], isDone?: boolean }) {
    const containerRef = useRef<HTMLPreElement>(null)
    const processed = useMemo(() => {
        const result: string[] = []

        for (const line of text) {
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
    }, [text])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const shouldScroll = el.scrollTop + el.clientHeight >= el.scrollHeight - (isDone ? 1000 : 200)
        if (shouldScroll) el.scrollTop = el.scrollHeight
    }, [processed, isDone])

    return (
        <pre
            ref={containerRef}
            className={`rounded-md p-2 text-xs text-gray-200 whitespace-pre-wrap font-mono h-[110%] ${isDone && 'pb-30'} overflow-auto`}
        >
            {processed.join('\n')}
        </pre>
    )
}
