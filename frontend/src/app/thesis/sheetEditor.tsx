'use client'

import { useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'
import { cellValue, columnName, reshape, tables, writeTable, type TableData, type Sheet } from './workspace'
import InlineMarkdown from './inlineMarkdown'
import './workspace.css'

const button = 'rounded-lg border border-ui-border px-3 py-2 text-sm hover:bg-ui-raised disabled:opacity-40'
export function RenderMarkdown({ text }: { text: string }) {
    return <div className='thesis-markdown'><Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown></div>
}

function InlineTable({ data, onChange, onMoveUp, onMoveDown }: { data: TableData, onChange?: (data: TableData) => void, onMoveUp?: () => void, onMoveDown?: () => void }) {
    const [selected, setSelected] = useState<[number, number]>([1, 0])
    const [focused, setFocused] = useState('')
    const row = Math.min(selected[0], data.cells.length - 1), col = Math.min(selected[1], data.cells[0].length - 1)
    const resize = useRef<{ axis: 'row' | 'column', index: number, start: number, size: number, value: number } | null>(null)
    function resizeHandle(axis: 'row' | 'column', index: number) {
        const size = (axis === 'row' ? data.heights[index] : data.widths[index]) || (axis === 'row' ? 48 : 180)
        return <span role='separator' tabIndex={0} aria-label={`Resize ${axis} ${axis === 'row' ? index + 1 : columnName(index)}`} aria-orientation={axis === 'row' ? 'horizontal' : 'vertical'} aria-valuenow={size} aria-valuemin={40} aria-valuemax={1200}
            className={`thesis-resize thesis-resize-${axis}`}
            onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
                event.preventDefault()
                const values = [...(axis === 'row' ? data.heights : data.widths)]
                values[index] = Math.max(40, Math.min(1200, size + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -10 : 10)))
                onChange?.({ ...data, [axis === 'row' ? 'heights' : 'widths']: values })
            }}
            onPointerDown={event => {
                event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
                resize.current = { axis, index, start: axis === 'row' ? event.clientY : event.clientX, size, value: size }
            }}
            onPointerMove={event => {
                if (!resize.current) return
                const state = resize.current
                state.value = Math.max(40, Math.min(1200, state.size + (axis === 'row' ? event.clientY : event.clientX) - state.start))
                event.currentTarget.setAttribute('aria-valuenow', String(state.value))
                const table = event.currentTarget.closest('table')!
                if (axis === 'row') (table.rows[index] as HTMLElement).style.height = `${state.value}px`
                else (table.querySelectorAll('col')[index] as HTMLElement).style.width = `${state.value}px`
            }}
            onPointerUp={() => {
                if (!resize.current) return
                const values = [...(axis === 'row' ? data.heights : data.widths)]
                values[index] = resize.current.value
                resize.current = null
                onChange?.({ ...data, [axis === 'row' ? 'heights' : 'widths']: values })
            }} onPointerCancel={() => { resize.current = null }} />
    }
    return <section className='thesis-table-block' aria-label='Inline table'>
        {onChange && <div className='flex flex-wrap items-center gap-2 py-3'>
            <button className={button} aria-label='Move table up' disabled={!onMoveUp} onClick={onMoveUp}>↑</button>
            <button className={button} aria-label='Move table down' disabled={!onMoveDown} onClick={onMoveDown}>↓</button>
            <span className='mr-2 text-sm text-ui-muted'>{columnName(col)}{row + 1}</span>
            <button className={button} onClick={() => onChange(reshape(data, 'row', row + 1, false))}>Add row below</button>
            <button className={button} disabled={row === 0 || data.cells.length <= 1} onClick={() => onChange(reshape(data, 'row', row, true))}>Remove row</button>
            <button className={button} onClick={() => onChange(reshape(data, 'column', col + 1, false))}>Add column after</button>
            <button className={button} disabled={data.cells[0].length <= 1} onClick={() => onChange(reshape(data, 'column', col, true))}>Remove column</button>
        </div>}
        <div className='thesis-table-scroll'>
            <table style={{ width: data.cells[0].reduce((sum, _, c) => sum + (data.widths[c] || 180), 0) }}>
                <colgroup>{data.cells[0].map((_, c) => <col key={c} style={{ width: data.widths[c] || 180 }} />)}</colgroup>
                <tbody>{data.cells.map((cells, r) => <tr key={r} style={{ height: data.heights[r] || 48 }}>{cells.map((raw, c) => {
                    const Cell = r === 0 ? 'th' : 'td'
                    const address = `${columnName(c)}${r + 1}`
                    const value = cellValue(data.cells, r, c)
                    return <Cell key={c} scope={r === 0 ? 'col' : undefined}>
                        {onChange ? <textarea aria-label={`Cell ${address}`} spellCheck={false} rows={Math.max(1, raw.split('\n').length)} value={focused === address ? raw : value}
                            onFocus={() => { setFocused(address); setSelected([r, c]) }} onBlur={() => setFocused('')}
                            onChange={event => {
                                const next = data.cells.map(line => [...line]); next[r][c] = event.target.value
                                onChange({ ...data, cells: next })
                            }} onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.blur() }} /> : <RenderMarkdown text={value} />}
                        {onChange && r === 0 && resizeHandle('column', c)}
                        {onChange && c === 0 && resizeHandle('row', r)}
                    </Cell>
                })}</tr>)}</tbody>
            </table>
        </div>
        {onChange && <p className='mt-2 text-xs text-ui-muted'>Click a cell to edit. Enter adds a line. Drag the right header edge or the bottom of a first-column cell to resize. Row 1 is the header. Totals: =SUMMARIZE(B2:B5) or =SUMMARIZE(B2:G2). Text and empty cells are ignored.</p>}
    </section>
}

export default function SheetEditor({ sheet, canEdit, onChange }: { sheet: Sheet, canEdit: boolean, onChange: (field: 'title' | 'body', value: string) => void }) {
    const selection = useRef({ start: sheet.body.length, end: sheet.body.length })
    const parsed = tables(sheet.body)
    function prose(text: string, start: number, end: number) {
        return canEdit ? <InlineMarkdown text={text} label='Description Markdown'
            onSelection={(a, b) => { selection.current = { start: start + a, end: start + b } }}
            onChange={value => onChange('body', sheet.body.slice(0, start) + value + sheet.body.slice(end))} /> : <RenderMarkdown text={text} />
    }
    const blocks: { start: number, end: number }[] = []
    let blockOffset = 0
    for (const token of marked.lexer(sheet.body)) {
        const start = sheet.body.indexOf(token.raw, blockOffset)
        blockOffset = start + token.raw.length
        if (token.type !== 'space' && !token.raw.startsWith('<!-- thesis-table:')) blocks.push({ start, end: parsed.find(table => table.start === start)?.end ?? blockOffset })
    }
    function move(start: number, end: number, target: { start: number, end: number }, up: boolean) {
        const raw = sheet.body.slice(start, end)
        onChange('body', up
            ? sheet.body.slice(0, target.start) + raw + '\n\n' + sheet.body.slice(target.start, start) + sheet.body.slice(end)
            : sheet.body.slice(0, start) + sheet.body.slice(end, target.end) + '\n\n' + raw + sheet.body.slice(target.end))
    }
    let offset = 0
    const content = parsed.map((table, index) => {
        const before = prose(sheet.body.slice(offset, table.start), offset, table.start)
        offset = table.end
        const previous = blocks.findLast(block => block.end <= table.start)
        const next = blocks.find(block => block.start >= table.end)
        return <div key={index}>{before}<InlineTable data={table.data}
            onMoveUp={canEdit && previous ? () => move(table.start, table.end, previous, true) : undefined}
            onMoveDown={canEdit && next ? () => move(table.start, table.end, next, false) : undefined} onChange={canEdit ? data => onChange('body', sheet.body.slice(0, table.start) + writeTable(data) + sheet.body.slice(table.end)) : undefined} /></div>
    })
    function insert() {
        const start = Math.min(selection.current.start, sheet.body.length)
        const end = Math.min(selection.current.end, sheet.body.length)
        const value = '\n\n' + writeTable({ cells: [['Task', 'Hours', 'Notes'], ['', '', ''], ['', '', '']], widths: [], heights: [] }) + '\n'
        onChange('body', sheet.body.slice(0, start) + value + sheet.body.slice(end))
    }
    return <div className='grid min-w-0 gap-5'>
        {canEdit ? <InlineMarkdown text={sheet.title || '# Untitled'} label='Title Markdown' singleLine onChange={value => onChange('title', value)} /> : <RenderMarkdown text={sheet.title || '# Untitled'} />}
        <div className='min-w-0'>{content}{prose(sheet.body.slice(offset), offset, sheet.body.length)}</div>
        {canEdit && <button className={button + ' justify-self-start'} onMouseDown={event => event.preventDefault()} onClick={insert}>Insert table</button>}
    </div>
}
