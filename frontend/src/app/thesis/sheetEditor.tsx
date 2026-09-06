'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Info } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cellValue, columnName, reshape, tables, writeTable, type TableData, type Sheet } from './workspace'
import InlineMarkdown from './inlineMarkdown'
import markdownSpacing from './markdownSpacing'
import './workspace.css'

const button = 'min-h-11 rounded-lg border border-ui-border px-3 py-2 text-sm hover:bg-ui-raised disabled:opacity-40'
export function RenderMarkdown({ text }: { text: string }) {
    return <div className='thesis-markdown'><Markdown remarkPlugins={[remarkGfm, markdownSpacing]}>{text}</Markdown></div>
}

type Cell = { table: number, row: number, col: number }

function InlineTable({ data, index, active, onSelect, onNavigate, onChange }: { data: TableData, index: number, active: Cell | null, onSelect: (cell: Cell) => void, onNavigate: (cell: Cell) => void, onChange?: (data: TableData, group?: string) => void }) {
    const [focused, setFocused] = useState('')
    const resize = useRef<{ axis: 'row' | 'column', index: number, start: number, size: number, value: number } | null>(null)
    function resizeHandle(axis: 'row' | 'column', index: number) {
        const size = (axis === 'row' ? data.heights[index] : data.widths[index]) || (axis === 'row' ? 48 : 180)
        return <span role='separator' tabIndex={0} aria-label={`Resize ${axis} ${axis === 'row' ? index + 1 : columnName(index)}`} aria-orientation={axis === 'row' ? 'horizontal' : 'vertical'} aria-valuenow={size} aria-valuemin={40} aria-valuemax={1200}
            data-table-tools className={`thesis-resize thesis-resize-${axis}`}
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
        <div className='thesis-table-scroll'>
            <table style={{ width: data.cells[0].reduce((sum, _, c) => sum + (data.widths[c] || 180), 0) }}>
                <colgroup>{data.cells[0].map((_, c) => <col key={c} style={{ width: data.widths[c] || 180 }} />)}</colgroup>
                <tbody>{data.cells.map((cells, r) => <tr key={r} style={{ height: data.heights[r] || 48 }}>{cells.map((raw, c) => {
                    const Cell = r === 0 ? 'th' : 'td'
                    const address = `${columnName(c)}${r + 1}`
                    const value = cellValue(data.cells, r, c)
                    return <Cell key={c} data-active={active?.table === index && active.row === r && active.col === c} scope={r === 0 ? 'col' : undefined}>
                        {onChange ? <textarea data-table-cell={`${index}:${r}:${c}`} aria-label={`Cell ${address}`} spellCheck={false} rows={Math.max(1, raw.split('\n').length)} value={focused === address ? raw : value}
                            onFocus={() => { setFocused(address); onSelect({ table: index, row: r, col: c }) }} onBlur={() => setFocused('')}
                            onChange={event => {
                                const next = data.cells.map(line => [...line]); next[r][c] = event.target.value
                                onChange({ ...data, cells: next }, `cell:${index}:${r}:${c}`)
                            }} onKeyDown={event => {
                                if (event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
                                const input = event.currentTarget
                                if (event.key === 'Escape') { input.blur(); return }
                                if (input.selectionStart !== input.selectionEnd || (event.shiftKey && event.key !== 'Tab')) return
                                const cursor = input.selectionStart
                                let row = r, col = c
                                if (event.key === 'ArrowUp' && !raw.slice(0, cursor).includes('\n')) row--
                                else if (event.key === 'ArrowDown' && !raw.slice(cursor).includes('\n')) row++
                                else if (event.key === 'ArrowLeft' && cursor === 0) col--
                                else if (event.key === 'ArrowRight' && cursor === raw.length) col++
                                else if (event.key === 'Tab') {
                                    const next = r * data.cells[0].length + c + (event.shiftKey ? -1 : 1)
                                    row = Math.floor(next / data.cells[0].length); col = next % data.cells[0].length
                                } else return
                                if (row < 0 || col < 0 || row >= data.cells.length || col >= data.cells[0].length) return
                                event.preventDefault()
                                onNavigate({ table: index, row, col })
                            }} /> : <RenderMarkdown text={value} />}
                        {onChange && r === 0 && resizeHandle('column', c)}
                        {onChange && c === 0 && resizeHandle('row', r)}
                    </Cell>
                })}</tr>)}</tbody>
            </table>
        </div>

    </section>
}

export default function SheetEditor({ sheet, canEdit, onChange, actions }: { sheet: Sheet, canEdit: boolean, actions?: ReactNode, onChange: (field: 'title' | 'body', value: string, group?: string) => void }) {
    const root = useRef<HTMLDivElement>(null)
    const selection = useRef({ start: sheet.body.length, end: sheet.body.length })
    const [active, setActive] = useState<Cell | null>(null)
    const [help, setHelp] = useState(false)
    const helpId = useId()
    const parsed = tables(sheet.body)
    const table = active ? parsed[active.table] : undefined
    const cell = active && table && active.row < table.data.cells.length && active.col < table.data.cells[0].length ? active : null
    useEffect(() => {
        const clearOutside = (event: Event) => {
            const target = event.target as HTMLElement
            if (!root.current?.contains(target) || !target.closest('[data-table-cell], [data-table-tools]')) setActive(null)
        }
        window.document.addEventListener('click', clearOutside)
        window.document.addEventListener('focusin', clearOutside)
        return () => {
            window.document.removeEventListener('click', clearOutside)
            window.document.removeEventListener('focusin', clearOutside)
        }
    }, [])
    function focusCell(next: Cell) {
        setActive(next)
        requestAnimationFrame(() => {
            const input = root.current?.querySelector<HTMLTextAreaElement>(`[data-table-cell="${next.table}:${next.row}:${next.col}"]`)
            input?.focus()
            input?.setSelectionRange(input.value.length, input.value.length)
        })
    }
    function updateTable(index: number, data: TableData, group?: string) {
        const target = parsed[index]
        onChange('body', sheet.body.slice(0, target.start) + writeTable(data) + sheet.body.slice(target.end), group)
    }
    function changeShape(axis: 'row' | 'column', remove: boolean) {
        if (!cell || !table) return
        const index = axis === 'row' ? cell.row : cell.col
        const data = reshape(table.data, axis, index + (remove ? 0 : 1), remove)
        updateTable(cell.table, data)
        focusCell({ ...cell, row: axis === 'row' ? Math.min(index + (remove ? 0 : 1), data.cells.length - 1) : cell.row, col: axis === 'column' ? Math.min(index + (remove ? 0 : 1), data.cells[0].length - 1) : cell.col })
    }
    function prose(text: string, start: number, end: number) {
        return canEdit ? <InlineMarkdown text={text} label='Description Markdown' showEmptyHint={!parsed.length}
            onSelection={(a, b) => { selection.current = { start: start + a, end: start + b } }}
            onChange={(value, group) => onChange('body', sheet.body.slice(0, start) + value + sheet.body.slice(end), group ? `prose:${start}:${group}` : undefined)} /> : <RenderMarkdown text={text} />
    }
    let offset = 0
    const content = parsed.map((table, index) => {
        const before = prose(sheet.body.slice(offset, table.start), offset, table.start)
        offset = table.end
        return <div key={index}>{before}<InlineTable data={table.data} index={index} active={cell} onSelect={setActive} onNavigate={focusCell}
            onChange={canEdit ? (data, group) => updateTable(index, data, group) : undefined} /></div>
    })
    function insert() {
        const start = cell ? parsed[cell.table].end : Math.min(selection.current.start, sheet.body.length)
        const end = cell ? start : Math.min(selection.current.end, sheet.body.length)
        const value = '\n\n' + writeTable({ cells: [['Task', 'Hours', 'Notes'], ['', '', ''], ['', '', '']], widths: [], heights: [] }) + '\n'
        onChange('body', sheet.body.slice(0, start) + value + sheet.body.slice(end))
        setActive(null)
    }
    return <div ref={root} className='grid min-w-0 gap-5' onBlurCapture={event => {
        if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-table-cell], [data-table-tools]')) setActive(null)
    }}>
        <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
            <div className='min-w-0 flex-1'>
                {canEdit ? <InlineMarkdown text={sheet.title || '# Untitled'} label='Title Markdown' singleLine onChange={value => onChange('title', value, 'title')} /> : <RenderMarkdown text={sheet.title || '# Untitled'} />}
            </div>
            {(canEdit || actions) && <div data-table-tools className='flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2 md:max-w-[65%]' aria-label='Document actions'>
                {actions}
                {canEdit && <button className={button} onMouseDown={event => event.preventDefault()} onClick={insert}>Insert table</button>}
                {canEdit && parsed.length > 0 && <button type='button' className={button} aria-label='Table help' aria-expanded={help} aria-controls={helpId} onClick={() => setHelp(!help)}><Info size={18} /></button>}
                {canEdit && cell && table && <div className='flex flex-wrap items-center justify-end gap-2' role='group' aria-label='Active table controls'>
                    <span className='text-sm font-semibold text-ui-primary'>Table {cell.table + 1} · {columnName(cell.col)}{cell.row + 1}</span>
                    <button className={button} aria-label={`Add row below ${cell.row + 1}`} title={`Add row below ${cell.row + 1}`} onClick={() => changeShape('row', false)}>+ Row</button>
                    <button className={button} aria-label={`Remove row ${cell.row + 1}`} title={`Remove row ${cell.row + 1}`} disabled={cell.row === 0} onClick={() => changeShape('row', true)}>− Row</button>
                    <button className={button} aria-label={`Add column after ${columnName(cell.col)}`} title={`Add column after ${columnName(cell.col)}`} onClick={() => changeShape('column', false)}>+ Column</button>
                    <button className={button} aria-label={`Remove column ${columnName(cell.col)}`} title={`Remove column ${columnName(cell.col)}`} disabled={table.data.cells[0].length <= 1} onClick={() => changeShape('column', true)}>− Column</button>
                    <span className='flex gap-2 [@media(hover:hover)_and_(pointer:fine)]:hidden'>
                        <button className={button} aria-label='Cell above' disabled={cell.row === 0} onClick={() => focusCell({ ...cell, row: cell.row - 1 })}><ArrowUp size={18} /></button>
                        <button className={button} aria-label='Cell below' disabled={cell.row === table.data.cells.length - 1} onClick={() => focusCell({ ...cell, row: cell.row + 1 })}><ArrowDown size={18} /></button>
                    </span>
                </div>}
            </div>}
        </div>
        {canEdit && help && parsed.length > 0 && <div id={helpId} className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm leading-6'>
            <h2 className='font-semibold'>Working with tables</h2>
            <ul className='mt-2 list-disc space-y-1 pl-5'>
                <li>Select a cell to edit it. The toolbar shows the selected cell and its row and column.</li>
                <li>Use arrow keys to move between cells at the edge of the text, or Tab to move to the next cell. Enter adds a new line.</li>
                <li>Drag a column’s right edge or a row’s bottom edge to resize it. The first row contains column headings.</li>
                <li>For totals, enter <code>=SUMMARIZE(B2:B5)</code> for a column or <code>=SUMMARIZE(B2:G2)</code> for a row. Text and empty cells are skipped.</li>
            </ul>
        </div>}
        <div className='min-w-0'>{content}{prose(sheet.body.slice(offset), offset, sheet.body.length)}</div>
    </div>
}
