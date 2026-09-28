'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, LayoutGrid, Rows3 } from 'lucide-react'
import SheetEditor, { sheetButton, type CustomTableControls, type SheetEditorProps, type TableInteraction } from './sheetEditor'
import { columnName, tables, writeTable } from './workspace'
import './plan.css'

const planFields = [
    ['Task', ['task', 'goal', 'item', 'milestone']], ['Hours', ['hours', 'estimate', 'estimated hours', 'effort']], ['Notes', ['notes', 'note', 'description']],
    ['Status', ['status', 'state']], ['Sprint', ['sprint', 'iteration']], ['Progress', ['progress', '% complete']], ['Details', ['details', 'detail', 'updates']], ['Subgoals', ['subgoals', 'sub-goals', 'checklist']],
] as const
const statuses = ['Planned', 'In progress', 'Waiting', 'Completed']
const subgoalLines = (value: string) => value.split('\n').map(line => /^\s*-\s*\[([ xX])\]\s*(.*)$/.exec(line)).filter((match): match is RegExpExecArray => !!match).map(match => ({ done: match[1].toLowerCase() === 'x', text: match[2] }))

export default function PlanSheet(props: SheetEditorProps) {
    const { sheet, canEdit } = props
    const parsed = tables(sheet.body)
    const index = parsed.length ? 0 : -1
    const source = index >= 0 ? parsed[index].data : { cells: [['Task', 'Hours', 'Notes'], ['', '', '']], widths: [], heights: [] }
    const cells = source.cells.map(row => [...row])
    const fields = Object.fromEntries(planFields.map(([name, aliases]) => [name.toLowerCase(), cells[0].findIndex(header => aliases.includes(header.trim().toLowerCase() as never))])) as Record<'task' | 'hours' | 'notes' | 'status' | 'sprint' | 'progress' | 'details' | 'subgoals', number>
    for (let r = 1; r < cells.length; r++) {
        while (cells[r].length < cells[0].length) cells[r].push('')
        if (fields.status >= 0 && !cells[r][fields.status].trim()) cells[r][fields.status] = 'Planned'
    }
    const [view, setView] = useState<'table' | 'board'>('table')
    const [expanded, setExpanded] = useState<number | null>(null)
    const [sprintFilter, setSprintFilter] = useState('')
    const hasRowDetails = fields.notes >= 0 || fields.details >= 0 || fields.subgoals >= 0
    const hasPlanControls = index >= 0 && (fields.hours >= 0 || fields.status >= 0 || fields.sprint >= 0)
    const taskRows = cells.slice(1).map((row, i) => ({ row, index: i + 1 })).filter(({ row }) => fields.task < 0 || !/^(?:total|summary)$/i.test(row[fields.task]?.trim() ?? ''))
    const sprints = fields.sprint < 0 ? [] : [...new Set(taskRows.map(({ row }) => row[fields.sprint].trim()).filter(Boolean))].sort()
    const tasks = taskRows.filter(item => !sprintFilter || fields.sprint >= 0 && item.row[fields.sprint] === sprintFilter)
    const hours = fields.hours < 0 ? 0 : taskRows.reduce((sum, { row }) => sum + (Number.isFinite(Number(row[fields.hours])) ? Number(row[fields.hours]) : 0), 0)
    const completedHours = fields.hours < 0 || fields.status < 0 ? 0 : taskRows.reduce((sum, { row }) => sum + (row[fields.status] === 'Completed' && Number.isFinite(Number(row[fields.hours])) ? Number(row[fields.hours]) : 0), 0)
    const completed = fields.status < 0 ? 0 : taskRows.filter(({ row }) => row[fields.status] === 'Completed').length
    const inProgress = fields.status < 0 ? 0 : taskRows.filter(({ row }) => row[fields.status] === 'In progress').length


    function save(next: string[][]) {
        if (!canEdit || index < 0) return
        const table = parsed[index]
        props.onChange('body', sheet.body.slice(0, table.start) + writeTable({ ...source, cells: next }) + sheet.body.slice(table.end))
    }
    function update(row: number, col: number, value: string) {
        const next = cells.map(line => [...line])
        next[row][col] = value
        if (fields.subgoals >= 0 && col === fields.subgoals) {
            const goals = subgoalLines(value)
            if (goals.length && fields.progress >= 0) next[row][fields.progress] = String(Math.round(goals.filter(goal => goal.done).length / goals.length * 100))
        }
        save(next)
    }
    function changeRow(row: number, remove: boolean, direction: -1 | 1 = 1) {
        const next = cells.map(line => [...line])
        const at = remove ? row : Math.max(1, Math.min(row + (direction > 0 ? 1 : 0), next.length))
        if (remove) next.splice(at, 1)
        else next.splice(at, 0, next[0].map((_, col) => col === fields.status ? 'Planned' : ''))
        save(next)
        return Math.min(remove ? at : at, next.length - 1)
    }
    function changeColumn(col: number, direction: -1 | 1) {
        const next = cells.map(row => [...row])
        const at = Math.max(1, Math.min(col + (direction > 0 ? 1 : 0), next[0].length))
        let name = 'New column', suffix = 2
        while (next[0].includes(name)) name = `New column ${suffix++}`
        next[0].splice(at, 0, name)
        for (const row of next.slice(1)) row.splice(at, 0, '')
        save(next)
    }
    const customTable: CustomTableControls | undefined = index >= 0 ? {
        index, cells,
        changeRow,
        changeColumn,
        canRemoveRow: row => row > 0,
        extendRow: direction => changeRow(direction < 0 ? 1 : cells.length - 1, false, direction),
    } : undefined

    function expand(row: number) { setExpanded(expanded === row ? null : row) }
    function rowCells(row: string[], rowIndex: number, interaction: TableInteraction) {
        const input = (col: number, value = row[col], type = 'text') => <input aria-label={`Cell ${columnName(col)}${rowIndex + 1}`} value={value} disabled={!canEdit} type={type} min={col === fields.progress ? 0 : undefined} max={col === fields.progress ? 100 : undefined} step={col === fields.hours || col === fields.progress ? '0.25' : undefined} onFocus={() => interaction.onSelect({ table: index, row: rowIndex, col })} onClick={() => interaction.onSelect({ table: index, row: rowIndex, col })} onChange={event => update(rowIndex, col, event.target.value)} />
        const cell = (col: number, content: React.ReactNode) => <td key={col} role='cell' data-label={cells[0][col]} data-table-cell={`${index}:${rowIndex}:${col}`} data-active={interaction.active?.table === index && interaction.active.row === rowIndex && interaction.active.col === col} tabIndex={0} onFocus={() => interaction.onSelect({ table: index, row: rowIndex, col })} onClick={() => interaction.onSelect({ table: index, row: rowIndex, col })} onKeyDown={event => {
            if (event.metaKey || event.ctrlKey || event.altKey) return
            const nextRow = rowIndex + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)
            const nextCol = col + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)
            if (nextRow === rowIndex && nextCol === col) return
            event.preventDefault()
            interaction.onNavigate({ table: index, row: Math.max(0, Math.min(nextRow, cells.length - 1)), col: Math.max(0, Math.min(nextCol, cells[0].length - 1)) }, true)
        }}><span className='thesis-plan-mobile-label' aria-hidden='true'>{cells[0][col]}</span>{content}</td>
        return cells[0].map((_, col) => {
            const content = col === fields.task && fields.task >= 0 ? <div className='flex items-center gap-2'>{hasRowDetails && <button type='button' aria-label={`${expanded === rowIndex ? 'Collapse' : 'Expand'} details for ${(fields.task >= 0 && row[fields.task]) || `row ${rowIndex}`}`} aria-expanded={expanded === rowIndex} onClick={() => expand(rowIndex)}>{expanded === rowIndex ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>}{input(col)}</div>
                : col === fields.status && fields.status >= 0 ? <select aria-label={`Status for ${(fields.task >= 0 && row[fields.task]) || `row ${rowIndex}`}`} value={statuses.includes(row[col]) ? row[col] : 'Planned'} disabled={!canEdit} onFocus={() => interaction.onSelect({ table: index, row: rowIndex, col })} onChange={event => update(rowIndex, col, event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select>
                    : col === fields.subgoals && fields.subgoals >= 0 ? <span>{subgoalLines(row[col]).filter(goal => goal.done).length}/{subgoalLines(row[col]).length}</span>
                        : input(col, row[col], col === fields.hours || col === fields.progress ? 'number' : 'text')
            return cell(col, content)
        })
    }

    return <SheetEditor {...props} customTable={customTable} beforeContent={hasPlanControls && <section className='grid gap-4' aria-label='Plan controls'>
        <div className='grid gap-3 rounded-xl border border-ui-border bg-ui-raised p-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:p-4' aria-label='Plan summary'>
            {fields.hours >= 0 && <div><span className='block text-xs text-ui-muted'>Estimated hours</span><strong>{hours.toLocaleString()} h</strong></div>}
            {fields.hours >= 0 && fields.status >= 0 && <div><span className='block text-xs text-ui-muted'>Completed hours</span><strong>{completedHours.toLocaleString()} h</strong></div>}
            {fields.task >= 0 && fields.status >= 0 && <div><span className='block text-xs text-ui-muted'>Tasks completed</span><strong>{completed}/{taskRows.length}</strong></div>}
            {fields.status >= 0 && <div><span className='block text-xs text-ui-muted'>In progress</span><strong>{inProgress}</strong></div>}
            <div className='flex flex-wrap items-center gap-2'>
                {fields.sprint >= 0 && <label className='text-sm'>Sprint <select aria-label='Filter by sprint' value={sprintFilter} onChange={event => setSprintFilter(event.target.value)}><option value=''>All sprints</option>{sprints.map(sprint => <option key={sprint}>{sprint}</option>)}</select></label>}
                <button type='button' className={sheetButton} aria-pressed={view !== 'board' || fields.task < 0 || fields.status < 0} onClick={() => setView('table')}><Rows3 size={16} /> Table</button>
                {fields.task >= 0 && fields.status >= 0 && <button type='button' className={sheetButton} aria-pressed={view === 'board'} onClick={() => setView('board')}><LayoutGrid size={16} /> Board</button>}
            </div>
        </div>
    </section>} renderTable={(data, tableIndex, interaction) => {
        if (tableIndex !== index) return undefined
        const visible = view !== 'board' || fields.task < 0 || fields.status < 0 ? <div className='thesis-plan-table-scroll'><table className='thesis-plan-table' role='table' aria-label='Project plan tasks'><thead role='rowgroup'><tr role='row'>{cells[0].map((header, col) => <th role='columnheader' key={col}>{header}</th>)}</tr></thead><tbody role='rowgroup'>{tasks.map(({ row, index: rowIndex }) => <Fragment key={rowIndex}>
            <tr key={rowIndex} role='row'>
                {rowCells(row, rowIndex, interaction)}
            </tr>
            {expanded === rowIndex && <tr key={`${rowIndex}-details`} role='row' className='thesis-plan-expanded'><td role='cell' colSpan={cells[0].length}><div className='grid gap-4 p-4'>
                {fields.notes >= 0 && <label>Notes<textarea value={row[fields.notes]} disabled={!canEdit} rows={2} onChange={event => update(rowIndex, fields.notes, event.target.value)} /></label>}
                {fields.details >= 0 && <label>Details<textarea value={row[fields.details]} disabled={!canEdit} rows={3} placeholder='Add context, blockers, links, or progress updates' onChange={event => update(rowIndex, fields.details, event.target.value)} /></label>}
                {fields.subgoals >= 0 && <div><h3 className='mb-2 font-semibold'>Subgoals</h3><ul className='grid gap-2'>{subgoalLines(row[fields.subgoals]).map((goal, goalIndex) => <li key={goalIndex} className='flex items-center gap-2'><input type='checkbox' aria-label={`Complete subgoal ${goal.text}`} checked={goal.done} disabled={!canEdit} onChange={event => { const goals = subgoalLines(row[fields.subgoals]); goals[goalIndex].done = event.target.checked; update(rowIndex, fields.subgoals, goals.map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')) }} /><span>{goal.text}</span><button type='button' className='ml-auto text-ui-muted' disabled={!canEdit} onClick={() => update(rowIndex, fields.subgoals, subgoalLines(row[fields.subgoals]).filter((_, i) => i !== goalIndex).map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n'))}>Remove</button></li>)}</ul>
                    {canEdit && <form className='mt-3 flex gap-2' onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const field = form.elements.namedItem('subgoal') as HTMLInputElement; const text = field.value.trim(); if (!text) return; const goals = [...subgoalLines(row[fields.subgoals]), { done: false, text }]; update(rowIndex, fields.subgoals, goals.map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')); field.value = '' }}><input name='subgoal' aria-label='New subgoal' placeholder='Add a subgoal' /><button className={sheetButton}>Add subgoal</button></form>}
                </div>}
            </div></td></tr>}
        </Fragment>)}</tbody></table></div> : <div className='thesis-plan-board' aria-label='Kanban board'>{statuses.map(status => <section key={status} aria-label={`${status} tasks`}><h2>{status}<span>{tasks.filter(task => task.row[fields.status] === status).length}</span></h2>{tasks.filter(task => task.row[fields.status] === status).map(({ row, index: rowIndex }) => <article key={rowIndex} className='thesis-plan-card' data-table-cell={`${index}:${rowIndex}:0`} onClick={() => interaction.onSelect({ table: index, row: rowIndex, col: 0 })}>
            <div className='flex items-start justify-between gap-2'><input aria-label={`Task ${row[fields.task] || rowIndex}`} value={row[fields.task]} disabled={!canEdit} onChange={event => update(rowIndex, fields.task, event.target.value)} /><select aria-label={`Status for ${(fields.task >= 0 && row[fields.task]) || `row ${rowIndex}`}`} value={row[fields.status]} disabled={!canEdit} onChange={event => update(rowIndex, fields.status, event.target.value)}>{statuses.map(item => <option key={item}>{item}</option>)}</select></div>
            <div className='mt-2 grid grid-cols-2 gap-2 text-sm'>{fields.sprint >= 0 && <label>Sprint<input aria-label={`Sprint for ${row[fields.task]}`} value={row[fields.sprint]} disabled={!canEdit} onChange={event => update(rowIndex, fields.sprint, event.target.value)} /></label>}{fields.hours >= 0 && <label>Hours<input type='number' aria-label={`Hours for ${row[fields.task]}`} value={row[fields.hours]} disabled={!canEdit} onChange={event => update(rowIndex, fields.hours, event.target.value)} /></label>}{fields.progress >= 0 && <label>Progress %<input type='number' min={0} max={100} aria-label={`Progress for ${row[fields.task]}`} value={row[fields.progress]} disabled={!canEdit} onChange={event => update(rowIndex, fields.progress, event.target.value)} /></label>}</div>
            {hasRowDetails && <button type='button' className='mt-3 text-sm underline' aria-expanded={expanded === rowIndex} onClick={() => expand(rowIndex)}>{expanded === rowIndex ? 'Hide details' : 'Details and subgoals'}</button>}
            {expanded === rowIndex && <div className='mt-3 grid gap-2'>{fields.details >= 0 && <textarea aria-label={`Details for ${row[fields.task]}`} value={row[fields.details]} disabled={!canEdit} onChange={event => update(rowIndex, fields.details, event.target.value)} />}{fields.subgoals >= 0 && <textarea aria-label={`Subgoals for ${row[fields.task]}`} value={row[fields.subgoals]} disabled={!canEdit} onChange={event => update(rowIndex, fields.subgoals, event.target.value)} placeholder='- [ ] First subgoal' />}</div>}
        </article>)}</section>)}</div>
        return <section className='thesis-plan' aria-label='Project plan'>{visible}{data.cells.length === 0 && null}</section>
    }} />
}
