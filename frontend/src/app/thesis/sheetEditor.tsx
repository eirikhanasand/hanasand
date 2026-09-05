'use client'

import { useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cellValue, columnName, reshape, tables, writeTable, type TableData, type Sheet } from './workspace'
import './workspace.css'

const button = 'rounded-lg border border-ui-border px-3 py-2 text-sm hover:bg-ui-raised disabled:opacity-40'
export function RenderMarkdown({ text }: { text: string }) {
    return <div className='thesis-markdown'><Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown></div>
}

function InlineTable({ data, onChange }: { data: TableData, onChange?: (data: TableData) => void }) {
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
    const [source, setSource] = useState(false)
    const textarea = useRef<HTMLTextAreaElement>(null)
    const parsed = tables(sheet.body)
    let offset = 0
    const content = parsed.map((table, index) => {
        const before = sheet.body.slice(offset, table.start)
        offset = table.end
        return <div key={index}><RenderMarkdown text={before} /><InlineTable data={table.data} onChange={canEdit ? data => onChange('body', sheet.body.slice(0, table.start) + writeTable(data) + sheet.body.slice(table.end)) : undefined} /></div>
    })
    function insert() {
        const start = textarea.current?.selectionStart ?? sheet.body.length
        const end = textarea.current?.selectionEnd ?? start
        const value = '\n\n' + writeTable({ cells: [['Task', 'Hours', 'Notes'], ['', '', ''], ['', '', '']], widths: [], heights: [] }) + '\n'
        onChange('body', sheet.body.slice(0, start) + value + sheet.body.slice(end))
    }
    return <div className='grid min-w-0 gap-5'>
        {canEdit && <div className='flex flex-wrap gap-2'>
            <button className={button} aria-pressed={source} onClick={() => setSource(!source)}>{source ? 'Done editing markdown' : 'Edit markdown'}</button>
            <button className={button} onClick={insert}>Insert table</button>
        </div>}
        {source && canEdit ? <>
            <label className='grid gap-2 text-sm'>Title Markdown<input maxLength={500} className='rounded-lg border border-ui-border bg-ui-raised p-3' value={sheet.title} onChange={event => onChange('title', event.target.value)} /></label>
            <label className='grid gap-2 text-sm'>Description Markdown<textarea ref={textarea} maxLength={1_000_000} className='min-h-80 w-full resize-y rounded-lg border border-ui-border bg-ui-raised p-4 font-mono text-base leading-7' value={sheet.body} onChange={event => onChange('body', event.target.value)} /></label>
            <p className='text-sm text-ui-muted'>Insert tables at the cursor. Cut and paste a table with its sizing comment to move it between paragraphs. Preview below updates as you type.</p>
        </> : null}
        <RenderMarkdown text={sheet.title || '# Untitled'} />
        <div className='min-w-0'>{content}<RenderMarkdown text={sheet.body.slice(offset)} /></div>
    </div>
}
