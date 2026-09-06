'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cellValue, columnName, reshape, tables, writeTable, type TableData, type Sheet } from './workspace'
import InlineMarkdown from './inlineMarkdown'
import { navigateTable, type PendingTable } from './tableNavigation'
import markdownSpacing from './markdownSpacing'
import './workspace.css'

const button = 'min-h-11 rounded-lg border border-ui-border px-3 py-2 text-sm hover:bg-ui-raised disabled:opacity-40'
export function RenderMarkdown({ text }: { text: string }) {
    return <div className='thesis-markdown'><Markdown remarkPlugins={[remarkGfm, markdownSpacing]}>{text}</Markdown></div>
}

type Cell = { table: number, row: number, col: number }

function InlineTable({ data, index, active, onSelect, onNavigate, onChange }: { data: TableData, index: number, active: Cell | null, onSelect: (cell: Cell) => void, onNavigate: (cell: Cell, extend?: boolean) => void, onChange?: (data: TableData, group?: string) => void }) {
    const [focused, setFocused] = useState('')
    const [completionCell, setCompletionCell] = useState('')
    const [dismissedCompletion, setDismissedCompletion] = useState('')
    const composing = useRef(false)
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
                    const completion = '=SUMMARIZE()'
                    const suggestion = focused === address && completionCell === address && dismissedCompletion !== `${address}:${raw}` && /^=[a-z]*$/i.test(raw) && '=SUMMARIZE'.startsWith(raw.toUpperCase()) ? completion.slice(raw.length) : ''
                    return <Cell key={c} data-active={active?.table === index && active.row === r && active.col === c} scope={r === 0 ? 'col' : undefined}>
                        {onChange ? <textarea data-table-cell={`${index}:${r}:${c}`} aria-label={`Cell ${address}`} spellCheck={false} rows={Math.max(1, raw.split('\n').length)} value={focused === address ? raw : value}
                            onFocus={event => { setFocused(address); setDismissedCompletion(''); setCompletionCell(event.currentTarget.selectionStart === raw.length ? address : ''); onSelect({ table: index, row: r, col: c }) }} onBlur={() => { setFocused(''); setCompletionCell('') }}
                            aria-autocomplete='inline' aria-description={suggestion ? 'Tab to complete SUMMARIZE' : undefined}
                            onSelect={event => { const input = event.currentTarget; setCompletionCell(!composing.current && input.selectionStart === input.value.length && input.selectionEnd === input.value.length ? address : '') }}
                            onCompositionStart={() => { composing.current = true; setCompletionCell('') }}
                            onCompositionEnd={event => { composing.current = false; setCompletionCell(event.currentTarget.selectionStart === event.currentTarget.value.length ? address : '') }}
                            onChange={event => {
                                setDismissedCompletion('')
                                setCompletionCell(!composing.current && event.target.selectionStart === event.target.value.length ? address : '')
                                const next = data.cells.map(line => [...line]); next[r][c] = event.target.value
                                onChange({ ...data, cells: next }, `cell:${index}:${r}:${c}`)
                            }} onKeyDown={event => {
                                if (event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
                                const input = event.currentTarget
                                if (event.key === 'Escape') {
                                    if (suggestion) { event.preventDefault(); setDismissedCompletion(`${address}:${raw}`); setCompletionCell('') }
                                    else input.blur()
                                    return
                                }
                                if (event.key === 'Tab' && !event.shiftKey && suggestion && input.selectionStart === raw.length && input.selectionEnd === raw.length) {
                                    event.preventDefault()
                                    const next = data.cells.map(line => [...line]); next[r][c] = completion
                                    setCompletionCell('')
                                    onChange({ ...data, cells: next })
                                    requestAnimationFrame(() => input.setSelectionRange(completion.length - 1, completion.length - 1))
                                    return
                                }
                                if (event.key === 'Enter' && event.shiftKey) {
                                    event.preventDefault()
                                    onNavigate({ table: index, row: r + 1, col: c }, true)
                                    return
                                }
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
                                if (event.key === 'Tab' && (row < 0 || col < 0 || row >= data.cells.length || col >= data.cells[0].length)) return
                                event.preventDefault()
                                onNavigate({ table: index, row, col }, event.key !== 'Tab')
                            }} /> : <RenderMarkdown text={value} />}
                        {onChange && suggestion && <span className='thesis-formula-suggestion' aria-hidden='true'><span className='invisible'>{raw}</span>{suggestion}</span>}
                        {onChange && r === 0 && resizeHandle('column', c)}
                        {onChange && c === 0 && resizeHandle('row', r)}
                    </Cell>
                })}</tr>)}</tbody>
            </table>
        </div>

    </section>
}

export default function SheetEditor({ sheet, canEdit, onChange, actions, trailingActions, showInsertTable = true }: { sheet: Sheet, canEdit: boolean, actions?: ReactNode, trailingActions?: ReactNode, showInsertTable?: boolean, onChange: (field: 'title' | 'body', value: string, group?: string) => void }) {
    const root = useRef<HTMLDivElement>(null)
    const selection = useRef({ start: sheet.body.length, end: sheet.body.length })
    const [active, setActive] = useState<Cell | null>(null)
    const [pending, setPending] = useState<(PendingTable & { table: number, source: string }) | null>(null)
    const draft = active && canEdit && pending?.source === sheet.body ? pending : null
    const parsed = tables(sheet.body).map((table, index) => draft?.table === index ? { ...table, data: draft.data } : table)
    useEffect(() => { if (!active || pending?.source !== sheet.body) setPending(null) }, [active, sheet.body])
    const table = active ? parsed[active.table] : undefined
    const cell = active && table && active.row < table.data.cells.length && active.col < table.data.cells[0].length ? active : null
    useEffect(() => {
        let pointerTarget: HTMLElement | null = null
        const rememberPointer = (event: PointerEvent) => { pointerTarget = event.target as HTMLElement }
        const clearOutside = (event: Event) => {
            // Opening the toolbar can move the cell before pointer-up. Use the original target.
            const target = event.type === 'click' ? pointerTarget || event.target as HTMLElement : event.target as HTMLElement
            if (event.type === 'click') pointerTarget = null
            if (!root.current?.contains(target) || !target.closest('[data-table-cell], [data-table-tools]')) setActive(null)
        }
        window.document.addEventListener('pointerdown', rememberPointer, true)
        window.document.addEventListener('click', clearOutside)
        window.document.addEventListener('focusin', clearOutside)
        return () => {
            window.document.removeEventListener('pointerdown', rememberPointer, true)
            window.document.removeEventListener('click', clearOutside)
            window.document.removeEventListener('focusin', clearOutside)
        }
    }, [])
    function focusCell(next: Cell) {
        setActive(next)
        requestAnimationFrame(() => {
            const input = root.current?.querySelector<HTMLTextAreaElement>(`[data-table-cell="${next.table}:${next.row}:${next.col}"]`)
            input?.focus({ preventScroll: true })
            input?.setSelectionRange(input.value.length, input.value.length)
            const largeTable = (input?.closest('table')?.getBoundingClientRect().height || 0) > window.innerHeight
            input?.scrollIntoView({ block: largeTable ? 'center' : 'nearest', inline: 'nearest', behavior: 'instant' })
        })
    }
    function selectCell(next: Cell, extend = false, focus = false) {
        const current = parsed[next.table]
        if (!current) return
        const move = navigateTable(draft?.table === next.table ? draft : { data: current.data }, next, extend)
        setPending(move.row !== undefined || move.col !== undefined ? { ...move, table: next.table, source: sheet.body } : null)
        const target = { ...next, ...move.cell }
        if (focus || target.row !== next.row || target.col !== next.col) focusCell(target)
        else setActive(target)
    }
    function updateTable(index: number, data: TableData, group?: string, explicitShape = false) {
        if (draft?.table === index && !explicitShape && !data.cells.some((row, r) => row.some((value, c) => (r === draft.row || c === draft.col) && value.trim()))) {
            setPending({ ...draft, data })
            return
        }
        setPending(null)
        const target = parsed[index]
        onChange('body', sheet.body.slice(0, target.start) + writeTable(data) + sheet.body.slice(target.end), group)
    }
    function changeShape(axis: 'row' | 'column', remove: boolean) {
        if (!cell || !table) return
        const index = axis === 'row' ? cell.row : cell.col
        const data = reshape(table.data, axis, index + (remove ? 0 : 1), remove)
        updateTable(cell.table, data, undefined, true)
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
        return <div key={index}>{before}<InlineTable data={table.data} index={index} active={cell} onSelect={next => selectCell(next)} onNavigate={(next, extend) => selectCell(next, extend, true)}
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
        <div className='flex min-w-0 items-start gap-4'>
            <div className='min-w-0 flex-1'>
                {canEdit ? <InlineMarkdown text={sheet.title || '# Untitled'} label='Title Markdown' singleLine onChange={value => onChange('title', value, 'title')} /> : <RenderMarkdown text={sheet.title || '# Untitled'} />}
            </div>
            {(canEdit || actions) && <div data-table-tools className='thesis-document-actions' aria-label='Document actions'>
                {actions}
                {canEdit && showInsertTable && <button className={button} onMouseDown={event => event.preventDefault()} onClick={insert}>Insert table</button>}
                {trailingActions}
                {canEdit && cell && table && <div className='flex shrink-0 items-center gap-2' role='group' aria-label='Active table controls'>
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
        <div className='min-w-0'>{content}{prose(sheet.body.slice(offset), offset, sheet.body.length)}</div>
    </div>
}
