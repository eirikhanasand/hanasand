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
    const fields = Object.fromEntries(planFields.map(([name, aliases], fieldIndex) => {
        const found = cells[0].findIndex(header => aliases.includes(header.trim().toLowerCase() as never))
        if (found >= 0) return [name.toLowerCase(), found]
        const preferred = Math.min(fieldIndex, cells[0].length)
        if (preferred < cells[0].length && !cells[0][preferred].trim() && fieldIndex < 3) {
            cells[0][preferred] = name
            return [name.toLowerCase(), preferred]
        }
        const at = cells[0].length
        cells[0].push(name)
        for (const row of cells.slice(1)) row.push('')
        return [name.toLowerCase(), at]
    })) as Record<'task' | 'hours' | 'notes' | 'status' | 'sprint' | 'progress' | 'details' | 'subgoals', number>
    for (let r = 1; r < cells.length; r++) {
        while (cells[r].length < cells[0].length) cells[r].push('')
        if (!cells[r][fields.status].trim()) cells[r][fields.status] = 'Planned'
    }
    const [view, setView] = useState<'table' | 'board'>('table')
    const [expanded, setExpanded] = useState<number | null>(null)
    const [sprintFilter, setSprintFilter] = useState('')
    const taskRows = cells.slice(1).map((row, i) => ({ row, index: i + 1 })).filter(({ row }) => !/^(?:total|summary)$/i.test(row[fields.task].trim()))
    const sprints = [...new Set(taskRows.map(({ row }) => row[fields.sprint].trim()).filter(Boolean))].sort()
    const tasks = taskRows.filter(item => !sprintFilter || item.row[fields.sprint] === sprintFilter)
    const hours = taskRows.reduce((sum, { row }) => sum + (Number.isFinite(Number(row[fields.hours])) ? Number(row[fields.hours]) : 0), 0)
    const completedHours = taskRows.reduce((sum, { row }) => sum + (row[fields.status] === 'Completed' && Number.isFinite(Number(row[fields.hours])) ? Number(row[fields.hours]) : 0), 0)
    const completed = taskRows.filter(({ row }) => row[fields.status] === 'Completed').length
    const inProgress = taskRows.filter(({ row }) => row[fields.status] === 'In progress').length

    function save(next: string[][]) {
        if (!canEdit || index < 0) return
        const table = parsed[index]
        props.onChange('body', sheet.body.slice(0, table.start) + writeTable({ ...source, cells: next }) + sheet.body.slice(table.end))
    }
    function update(row: number, col: number, value: string) {
        const next = cells.map(line => [...line])
        next[row][col] = value
        if (col === fields.subgoals) {
            const goals = subgoalLines(value)
            if (goals.length) next[row][5] = String(Math.round(goals.filter(goal => goal.done).length / goals.length * 100))
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
        const cell = (col: number, content: React.ReactNode) => <td key={col} data-table-cell={`${index}:${rowIndex}:${col}`} data-active={interaction.active?.table === index && interaction.active.row === rowIndex && interaction.active.col === col} tabIndex={0} onFocus={() => interaction.onSelect({ table: index, row: rowIndex, col })} onClick={() => interaction.onSelect({ table: index, row: rowIndex, col })} onKeyDown={event => {
            if (event.metaKey || event.ctrlKey || event.altKey) return
            const nextRow = rowIndex + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)
            const nextCol = col + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)
            if (nextRow === rowIndex && nextCol === col) return
            event.preventDefault()
            interaction.onNavigate({ table: index, row: Math.max(0, Math.min(nextRow, cells.length - 1)), col: Math.max(0, Math.min(nextCol, cells[0].length - 1)) }, true)
        }}>{content}</td>
        return cells[0].map((_, col) => {
            const content = col === fields.task ? <div className='flex items-center gap-2'><button type='button' aria-label={`${expanded === rowIndex ? 'Collapse' : 'Expand'} details for ${row[fields.task] || `task ${rowIndex}`}`} aria-expanded={expanded === rowIndex} onClick={() => expand(rowIndex)}>{expanded === rowIndex ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>{input(col)}</div>
                : col === fields.status ? <select aria-label={`Status for ${row[fields.task] || `task ${rowIndex}`}`} value={statuses.includes(row[col]) ? row[col] : 'Planned'} disabled={!canEdit} onFocus={() => interaction.onSelect({ table: index, row: rowIndex, col })} onChange={event => update(rowIndex, col, event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select>
                    : col === fields.subgoals ? <span>{subgoalLines(row[col]).filter(goal => goal.done).length}/{subgoalLines(row[col]).length}</span>
                        : input(col, row[col], col === fields.hours || col === fields.progress ? 'number' : 'text')
            return cell(col, content)
        })
    }

    return <SheetEditor {...props} customTable={customTable} beforeContent={<section className='grid gap-4' aria-label='Plan controls'>
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-border bg-ui-raised p-4' aria-label='Plan summary'>
            <div><span className='block text-xs text-ui-muted'>Estimated hours</span><strong>{hours.toLocaleString()} h</strong></div>
            <div><span className='block text-xs text-ui-muted'>Completed hours</span><strong>{completedHours.toLocaleString()} h</strong></div>
            <div><span className='block text-xs text-ui-muted'>Tasks completed</span><strong>{completed}/{taskRows.length}</strong></div>
            <div><span className='block text-xs text-ui-muted'>In progress</span><strong>{inProgress}</strong></div>
            <div className='flex flex-wrap items-center gap-2'>
                <label className='text-sm'>Sprint <select aria-label='Filter by sprint' value={sprintFilter} onChange={event => setSprintFilter(event.target.value)}><option value=''>All sprints</option>{sprints.map(sprint => <option key={sprint}>{sprint}</option>)}</select></label>
                <button type='button' className={sheetButton} aria-pressed={view === 'table'} onClick={() => setView('table')}><Rows3 size={16} /> Table</button>
                <button type='button' className={sheetButton} aria-pressed={view === 'board'} onClick={() => setView('board')}><LayoutGrid size={16} /> Board</button>
            </div>
        </div>
    </section>} renderTable={(data, tableIndex, interaction) => {
        if (tableIndex !== index) return undefined
        const visible = view === 'table' ? <div className='thesis-plan-table-scroll'><table className='thesis-plan-table'><thead><tr>{cells[0].map((header, col) => <th key={col}>{header}</th>)}</tr></thead><tbody>{tasks.map(({ row, index: rowIndex }) => <Fragment key={rowIndex}>
            <tr key={rowIndex}>
                {rowCells(row, rowIndex, interaction)}
            </tr>
            {expanded === rowIndex && <tr key={`${rowIndex}-details`} className='thesis-plan-expanded'><td colSpan={cells[0].length}><div className='grid gap-4 p-4'>
                <label>Notes<textarea value={row[fields.notes]} disabled={!canEdit} rows={2} onChange={event => update(rowIndex, fields.notes, event.target.value)} /></label>
                <label>Details<textarea value={row[fields.details]} disabled={!canEdit} rows={3} placeholder='Add context, blockers, links, or progress updates' onChange={event => update(rowIndex, fields.details, event.target.value)} /></label>
                <div><h3 className='mb-2 font-semibold'>Subgoals</h3><ul className='grid gap-2'>{subgoalLines(row[fields.subgoals]).map((goal, goalIndex) => <li key={goalIndex} className='flex items-center gap-2'><input type='checkbox' aria-label={`Complete subgoal ${goal.text}`} checked={goal.done} disabled={!canEdit} onChange={event => { const goals = subgoalLines(row[fields.subgoals]); goals[goalIndex].done = event.target.checked; update(rowIndex, fields.subgoals, goals.map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')) }} /><span>{goal.text}</span><button type='button' className='ml-auto text-ui-muted' disabled={!canEdit} onClick={() => update(rowIndex, fields.subgoals, subgoalLines(row[fields.subgoals]).filter((_, i) => i !== goalIndex).map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n'))}>Remove</button></li>)}</ul>
                    {canEdit && <form className='mt-3 flex gap-2' onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const field = form.elements.namedItem('subgoal') as HTMLInputElement; const text = field.value.trim(); if (!text) return; const goals = [...subgoalLines(row[fields.subgoals]), { done: false, text }]; update(rowIndex, fields.subgoals, goals.map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')); field.value = '' }}><input name='subgoal' aria-label='New subgoal' placeholder='Add a subgoal' /><button className={sheetButton}>Add subgoal</button></form>}
                </div>
            </div></td></tr>}
        </Fragment>)}</tbody></table></div> : <div className='thesis-plan-board' aria-label='Kanban board'>{statuses.map(status => <section key={status} aria-label={`${status} tasks`}><h2>{status}<span>{tasks.filter(task => task.row[fields.status] === status).length}</span></h2>{tasks.filter(task => task.row[fields.status] === status).map(({ row, index: rowIndex }) => <article key={rowIndex} className='thesis-plan-card' data-table-cell={`${index}:${rowIndex}:0`} onClick={() => interaction.onSelect({ table: index, row: rowIndex, col: 0 })}>
            <div className='flex items-start justify-between gap-2'><input aria-label={`Task ${row[fields.task] || rowIndex}`} value={row[fields.task]} disabled={!canEdit} onChange={event => update(rowIndex, fields.task, event.target.value)} /><select aria-label={`Status for ${row[fields.task] || `task ${rowIndex}`}`} value={row[fields.status]} disabled={!canEdit} onChange={event => update(rowIndex, fields.status, event.target.value)}>{statuses.map(item => <option key={item}>{item}</option>)}</select></div>
            <div className='mt-2 grid grid-cols-2 gap-2 text-sm'><label>Sprint<input aria-label={`Sprint for ${row[fields.task]}`} value={row[fields.sprint]} disabled={!canEdit} onChange={event => update(rowIndex, fields.sprint, event.target.value)} /></label><label>Hours<input type='number' aria-label={`Hours for ${row[fields.task]}`} value={row[fields.hours]} disabled={!canEdit} onChange={event => update(rowIndex, fields.hours, event.target.value)} /></label><label>Progress %<input type='number' min={0} max={100} aria-label={`Progress for ${row[fields.task]}`} value={row[fields.progress]} disabled={!canEdit} onChange={event => update(rowIndex, fields.progress, event.target.value)} /></label></div>
            <button type='button' className='mt-3 text-sm underline' aria-expanded={expanded === rowIndex} onClick={() => expand(rowIndex)}>{expanded === rowIndex ? 'Hide details' : 'Details and subgoals'}</button>
            {expanded === rowIndex && <div className='mt-3 grid gap-2'><textarea aria-label={`Details for ${row[fields.task]}`} value={row[fields.details]} disabled={!canEdit} onChange={event => update(rowIndex, fields.details, event.target.value)} /><textarea aria-label={`Subgoals for ${row[fields.task]}`} value={row[fields.subgoals]} disabled={!canEdit} onChange={event => update(rowIndex, fields.subgoals, event.target.value)} placeholder='- [ ] First subgoal' /></div>}
        </article>)}</section>)}</div>
        return <section className='thesis-plan' aria-label='Project plan'>{visible}{data.cells.length === 0 && null}</section>
    }} />
}
