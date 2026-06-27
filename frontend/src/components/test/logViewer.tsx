import { useEffect, useRef, useMemo } from 'react'

export default function LogViewer({ text, isDone }: { text: string[], isDone?: boolean }) {
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
            className={`h-full max-h-full min-h-[10rem] min-w-0 overflow-auto rounded-md border border-[#dfe5ee] bg-[#0f172a] p-3 font-mono text-xs leading-5 text-[#e2e8f0] whitespace-pre-wrap wrap-break-word shadow-inner dark:border-[#30415f] dark:bg-[#08111f] dark:text-[#d8e0ed] ${isDone ? 'pb-8' : ''}`}
        >
            {processed.join('\n')}
        </pre>
    )
}
