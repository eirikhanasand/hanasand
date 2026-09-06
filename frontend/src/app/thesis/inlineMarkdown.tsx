'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'
import type { Root } from 'mdast'
import markdownSpacing from './markdownSpacing'

type SourceNode = {
    type: string, value?: string, children?: SourceNode[],
    position?: { start: { line: number }, end: { line: number } },
    data?: { hName?: string, hProperties?: Record<string, unknown> },
}

// Preserve the normal markdown tree; source positions let a click find its physical line.
function sourceLines() {
    return (tree: Root) => {
        function visit(node: SourceNode) {
            if (node.type === 'text' && node.position) {
                const start = node.position.start.line
                node.children = (node.value || '').split('\n').flatMap((value, index) => [
                    ...(index ? [{ type: 'text', value: '\n' }] : []),
                    { type: 'sourceLine', data: { hName: 'span', hProperties: { 'data-source-line': start + index } }, children: [{ type: 'text', value }] },
                ])
                node.type = 'sourceLine'
                node.data = { hName: 'span' }
                delete node.value
                return
            }
            if (node.position) node.data = { ...node.data, hProperties: { ...node.data?.hProperties, 'data-source-line': node.position.start.line } }
            node.children?.forEach(visit)
        }
        visit(tree as SourceNode)
    }
}

export default function InlineMarkdown({ text, label, singleLine = false, showEmptyHint = true, onChange, onSelection }: {
    text: string, label: string, singleLine?: boolean, showEmptyHint?: boolean,
    onChange: (text: string, group?: string) => void, onSelection?: (start: number, end: number) => void,
}) {
    const [active, setActive] = useState<number | null>(null)
    const input = useRef<HTMLTextAreaElement>(null)
    const cursor = useRef<number | null>(null)
    const lines = text.split('\n')
    const line = active === null ? null : Math.min(active, lines.length - 1)
    const start = line === null ? 0 : lines.slice(0, line).reduce((length, value) => length + value.length + 1, 0)
    const value = line === null ? '' : lines[line]

    useLayoutEffect(() => {
        if (!input.current || line === null) return
        const element = input.current
        element.style.height = '0px'
        element.style.height = `${element.scrollHeight}px`
        if (cursor.current !== null) {
            element.focus()
            element.setSelectionRange(cursor.current, cursor.current)
            cursor.current = null
        }
    }, [text, line])

    function select(next: number, position?: number) {
        const selected = Math.max(0, Math.min(next, lines.length - 1))
        cursor.current = position ?? lines[selected].length
        setActive(selected)
    }
    function change(next: string, nextLine: number, position: number, typing = false) {
        cursor.current = position
        setActive(nextLine)
        onChange(next, typing ? `line:${line ?? 0}` : undefined)
    }
    function render(source: string, firstLine: number, key: string, count: number) {
        if (!count || (!showEmptyHint && !source.trim())) return null
        return <div key={key} className='thesis-markdown thesis-inline-render' tabIndex={0} role='group' aria-label={`${label}, click a line to edit`}
            onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(firstLine) } }}
            onPointerDown={event => {
                if (event.button !== 0) return
                const target = event.target as HTMLElement
                if (target.closest('a')) return
                event.preventDefault()
                const node = target.closest<HTMLElement>('[data-source-line]')
                let selected = Number(node?.dataset.sourceLine || 1) - 1 + firstLine
                if (!node) {
                    const preceding = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-source-line]')].filter(item => item.getBoundingClientRect().bottom <= event.clientY)
                    if (preceding.length) selected = Math.max(...preceding.map(item => Number(item.dataset.sourceLine))) + firstLine
                }
                const code = target.closest('pre')
                if (code) {
                    const top = code.getBoundingClientRect().top + parseFloat(getComputedStyle(code).paddingTop)
                    selected += 1 + Math.floor(Math.max(0, event.clientY - top) / parseFloat(getComputedStyle(code).lineHeight))
                }
                select(selected)
            }}>
            <Markdown remarkPlugins={[remarkGfm, markdownSpacing, sourceLines]}>{source}</Markdown>
        </div>
    }

    let before = line === null ? text : lines.slice(0, line).join('\n')
    let after = line === null ? '' : lines.slice(line + 1).join('\n')
    let afterLine = (line ?? -1) + 1
    // Keep fenced code rendered as code on both sides of the active source line.
    if (line !== null) {
        let offset = 0
        for (const token of marked.lexer(text)) {
            const tokenStart = text.indexOf(token.raw, offset)
            offset = tokenStart + token.raw.length
            const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*\n/.exec(token.raw)
            if (token.type === 'code' && fence && start >= tokenStart && start < offset) {
                if (start > tokenStart) before += '\n' + fence[1]
                if (after && start + value.length + 1 < offset) { after = fence[0] + after; afterLine-- }
                break
            }
        }
    }
    return <div className='thesis-inline-document'>
        {render(before, 0, 'before', line ?? lines.length)}
        {line !== null && <textarea ref={input} aria-label={label} rows={1} className='thesis-inline-input' value={value}
            maxLength={singleLine ? 500 : 1_000_000} spellCheck
            onBlur={() => setActive(null)}
            onSelect={event => onSelection?.(start + event.currentTarget.selectionStart, start + event.currentTarget.selectionEnd)}
            onChange={event => {
                const replacement = singleLine ? event.target.value.replace(/\n/g, ' ') : event.target.value
                const position = event.target.selectionStart
                const preceding = replacement.slice(0, position).split('\n')
                onSelection?.(start + position, start + position)
                change(text.slice(0, start) + replacement + text.slice(start + value.length), line + preceding.length - 1, preceding.at(-1)!.length, true)
            }}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing) return
                const element = event.currentTarget
                const a = element.selectionStart, b = element.selectionEnd
                if (event.key === 'Escape' || (singleLine && event.key === 'Enter')) {
                    event.preventDefault(); element.blur()
                } else if (!singleLine && event.key === 'Enter') {
                    event.preventDefault()
                    change(text.slice(0, start + a) + '\n' + text.slice(start + b), line + 1, 0)
                } else if (!singleLine && a === b && event.key === 'Backspace' && a === 0 && line > 0) {
                    event.preventDefault(); change(text.slice(0, start - 1) + text.slice(start), line - 1, lines[line - 1].length)
                } else if (!singleLine && a === b && event.key === 'Delete' && b === value.length && line < lines.length - 1) {
                    event.preventDefault(); change(text.slice(0, start + value.length) + text.slice(start + value.length + 1), line, b)
                } else if (a === b && event.key === 'ArrowUp' && a === 0 && line > 0) {
                    event.preventDefault(); select(line - 1)
                } else if (a === b && event.key === 'ArrowDown' && b === value.length && line < lines.length - 1) {
                    event.preventDefault(); select(line + 1, 0)
                }
            }} />}
        {render(after, afterLine, 'after', line === null ? 0 : lines.length - line - 1)}
        {line === null && !singleLine && <div className='thesis-inline-empty' role='button' tabIndex={0} aria-label={`Add text to ${label}`}
            onClick={() => {
                if (!text || text.endsWith('\n')) select(lines.length - 1, 0)
                else { cursor.current = 0; setActive(lines.length); onChange(text + '\n') }
            }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click() } }}>
            {!text && showEmptyHint ? 'Write here…' : '\u00a0'}
        </div>}
    </div>
}
