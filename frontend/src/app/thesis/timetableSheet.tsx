'use client'

import { Fragment, useId, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardPlus, Download, Pencil, Trash2, X } from 'lucide-react'
import SheetEditor, { type SheetEditorProps } from './sheetEditor'
import { tables, writeTable } from './workspace'
import { activityError, hoursText, initialTimetableYear, isTimetable, isoWeek, timetable, type Activity, type ActivityLog, type Week } from './timetableData'
import './timetable.css'

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function ActivityForm({ categories, activities, week, existing, onAdd, onClose }: { categories: string[], activities: Activity[], week?: Week, existing?: Activity, onAdd: (activity: Activity) => boolean, onClose: () => void }) {
    const [date, setDate] = useState(existing?.date || (week ? (today() >= week.start && today() <= week.end ? today() : week.start) : today()))
    const [hours, setHours] = useState(existing ? hoursText(existing.hours) : '')
    const [category, setCategory] = useState(existing?.category || categories[0] || 'Research')
    const [description, setDescription] = useState(existing?.description || '')
    const [error, setError] = useState('')
    return <form className='thesis-activity-form' aria-label={existing ? 'Edit activity' : 'Log activity'} onSubmit={event => {
        event.preventDefault()
        const activity = { id: existing?.id || crypto.randomUUID(), date, hours: Number(hours), category: category.trim(), description: description.trim() }
        const error = activityError(activity, activities) || (week && isoWeek(date).key !== week.key ? 'Choose a date in this week, or use the log icon above for another week.' : '')
        if (error) { setError(error); return }
        if (onAdd(activity)) onClose()
    }}>
        <label>Date<input type='date' required min={week?.start || '1900-01-01'} max={week?.end || '2199-12-31'} value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Hours<input type='number' inputMode='decimal' required min='0.01' max='24' step='0.01' value={hours} onChange={event => setHours(event.target.value)} /></label>
        <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className='thesis-activity-description'>Description<textarea required maxLength={4000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder='What did you work on?' /></label>
        {error && <p role='alert'>{error}</p>}
        <div className='thesis-activity-form-actions'><button type='button' onClick={onClose}>Cancel</button><button type='submit'>{existing ? 'Update activity' : 'Add activity'}</button></div>
    </form>
}

export default function TimetableSheet({ onActivityLogChange, ...props }: SheetEditorProps & { onActivityLogChange?: (log: ActivityLog) => boolean }) {
    const instanceId = useId()
    const { sheet, canEdit } = props
    const parsed = tables(sheet.body)
    const target = parsed.findIndex(table => isTimetable(table.data))
    const log = sheet.activityLog || { startYear: initialTimetableYear, activities: [] }
    const model = target >= 0 ? timetable(parsed[target].data, log) : null
    const [expanded, setExpanded] = useState<string | null>(null)
    const [form, setForm] = useState<{ week?: string, activity?: Activity } | null>(null)
    const [message, setMessage] = useState('')
    const [pdfBusy, setPdfBusy] = useState(false)
    const [pdfError, setPdfError] = useState('')
    const [planDate, setPlanDate] = useState(today())
    function changeWeek(week: Week | undefined, date?: string) {
        if (!canEdit || !model) return
        const table = parsed[target]
        const cells = table.data.cells.map(row => [...row])
        for (const planned of model.weeks) if (planned.sourceRow !== undefined) cells[planned.sourceRow][0] = planned.key
        if (week?.sourceRow !== undefined) cells.splice(week.sourceRow, 1)
        else if (date) {
            const chosen = isoWeek(date)
            if (model.weeks.some(item => item.key === chosen.key && item.sourceRow !== undefined)) { setMessage('That week is already in the plan.'); return }
            cells.push([chosen.key, ...cells[0].slice(1).map(() => '')])
        }
        const summary = cells.find(row => /^(?:total(?:\s|$)|\d+\s+weeks$)/i.test(row[0].trim()))
        if (summary) summary[0] = `${model.plannedWeeks + (week?.sourceRow !== undefined ? -1 : 1)} weeks`
        props.onChange('body', sheet.body.slice(0, table.start) + writeTable({ ...table.data, cells, heights: [] }) + sheet.body.slice(table.end))
        setMessage(week?.sourceRow !== undefined ? 'Week removed from the plan. Its logged activities are kept. Use Undo to restore the row.' : 'Week added to the plan.')
    }
    function save(activity: Activity) {
        if (!canEdit || !onActivityLogChange) return false
        if (form?.activity && !log.activities.some(item => item.id === form.activity!.id)) { setMessage('This activity was removed in another edit. Close the form and check the latest log.'); return false }
        const exists = log.activities.some(item => item.id === activity.id)
        const next = exists ? log.activities.map(item => item.id === activity.id ? activity : item) : [...log.activities, activity]
        if (!onActivityLogChange({ ...log, activities: next })) return false
        setMessage(`${exists ? 'Updated' : 'Added'} ${hoursText(activity.hours)} hours on ${activity.date}.`)
        return true
    }
    function remove(activity: Activity) {
        if (canEdit && onActivityLogChange?.({ ...log, activities: log.activities.filter(item => item.id !== activity.id) })) {
            if (form?.activity?.id === activity.id) setForm(null)
            setMessage(`Removed activity on ${activity.date}. Use Undo to restore it.`)
        }
    }
    function activityForm(week?: Week) {
        return model && <ActivityForm key={form?.activity?.id || week?.key || 'quick'} categories={model.categories} activities={log.activities} week={week} existing={form?.activity} onAdd={save} onClose={() => setForm(null)} />
    }
    async function exportPdf() {
        if (!model) return
        setPdfBusy(true); setPdfError('')
        try {
            const { exportTimetablePdf } = await import('./timetablePdf')
            await exportTimetablePdf(sheet.title, model, log)
        } catch { setPdfError('The PDF could not be created. Please try again.') }
        finally { setPdfBusy(false) }
    }
    return <SheetEditor {...props} titleAside={model && <details className='thesis-hours-progress'><summary aria-label='Hours spent and expected'><strong>{model.totals.at(-1)} / {hoursText(model.expectedHours)} h</strong><span>spent / expected</span></summary><div>12 hours per week before Christmas; 7.5 hours per weekday from January. Before Christmas, each public holiday deducts 2.4 hours. Weeks 51–53 and Norwegian weekday public holidays are excluded. Work logged on days off still counts as spent.</div></details>} actions={<>
        {model && <>
            {canEdit && <button type='button' className='thesis-timetable-action' aria-label='Log activity' title='Log activity' aria-expanded={form !== null && !form.week} onClick={() => { setMessage(''); setForm(form && !form.week ? null : {}) }}><ClipboardPlus size={18} /></button>}
            <button type='button' className='thesis-timetable-action' aria-label='Export timetable as PDF' title='Export as PDF' disabled={pdfBusy} onClick={exportPdf}><Download size={18} /><span>{pdfBusy ? 'Exporting…' : 'PDF'}</span></button>
        </>}
        {props.actions}
    </>} beforeContent={<div className='thesis-timetable-controls'>
        {model && <p className='thesis-timetable-hint'>Hours by ISO week · {log.startYear}–{model.weeks.at(-1)?.year || log.startYear}. Select a week to see dated activities.</p>}
        {canEdit && model && <details className='thesis-plan-week'><summary>Plan a week</summary><form onSubmit={event => { event.preventDefault(); changeWeek(undefined, planDate) }}><label>Date in the week<input type='date' required min='1900-01-01' max='2199-12-31' value={planDate} onChange={event => setPlanDate(event.target.value)} /></label><button type='submit'>Add week</button></form></details>}
        {canEdit && form && !form.week && <section aria-label='Quick activity log' className='thesis-week-detail'><h2>Log activity</h2>{activityForm()}</section>}
        {message && <p role='status'>{message}</p>}
        {pdfError && <p role='alert'>{pdfError}</p>}
    </div>} renderTable={(data, index) => index !== target || !model ? undefined : <section className='thesis-timetable' aria-label='Weekly activity timetable'>
        <div className='thesis-timetable-scroll'><table>
            <thead><tr><th scope='col'>Week</th>{model.categories.map(category => <th key={category} scope='col'>{category}</th>)}<th scope='col'>Total</th></tr></thead>
            <tbody>{model.weeks.map(week => <Fragment key={week.key}>
                <tr className='thesis-week-row' data-week={week.key} onClick={event => { if (!(event.target as HTMLElement).closest('button')) setExpanded(expanded === week.key ? null : week.key) }}>
                    <th scope='row'><button type='button' aria-label={`Week ${week.week}, ${week.year}`} aria-expanded={expanded === week.key} aria-controls={`week-${instanceId}-${week.key}`} onClick={() => setExpanded(expanded === week.key ? null : week.key)}>{expanded === week.key ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<span>{week.week}<small>{week.year}</small></span></button></th>
                    {week.values.map((value, col) => <td key={col}>{value || '—'}</td>)}
                </tr>
                {expanded === week.key && <tr id={`week-${instanceId}-${week.key}`} className='thesis-week-expanded'><td colSpan={model.categories.length + 2}><section className='thesis-week-detail' aria-label={`Activities for week ${week.week}, ${week.year}`}>
                    <div className='thesis-week-heading'><div><h2>Week {week.week} · {week.year}</h2><p>{week.start} – {week.end} · {hoursText(week.expected)} expected hours</p></div><button type='button' aria-label='Close week details' onClick={() => setExpanded(null)}><X size={17} /></button></div>
                    {week.exclusions.length > 0 && <p className='thesis-timetable-hint'>{week.exclusions.join(' · ')}</p>}
                    {week.legacy && <p>Includes earlier totals without dated activity details. New entries are added to those totals.</p>}
                    {week.activities.length ? <ul className='thesis-activities'>{week.activities.map(activity => <li key={activity.id}>
                        <div><strong><time dateTime={activity.date}>{activity.date}</time> · {hoursText(activity.hours)} h · {activity.category}</strong><p>{activity.description}</p></div>
                        {canEdit && <div className='thesis-activity-tools'><button type='button' aria-label={`Edit activity ${activity.date}: ${activity.description}`} title='Edit activity' onClick={() => setForm({ week: week.key, activity })}><Pencil size={15} /></button><button type='button' aria-label={`Remove activity ${activity.date}: ${activity.description}`} title='Remove activity' onClick={() => remove(activity)}><Trash2 size={15} /></button></div>}
                    </li>)}</ul> : <p>No activities logged for this week.</p>}
                    {canEdit && (form?.week === week.key ? activityForm(week) : <button type='button' className='thesis-add-activity' onClick={() => setForm({ week: week.key })}><ClipboardPlus size={16} />Add activity</button>)}
                    {canEdit && <button type='button' className='thesis-week-plan-button' onClick={() => changeWeek(week, week.start)}>{week.sourceRow !== undefined ? 'Remove week from plan' : 'Include week in plan'}</button>}
                </section></td></tr>}
            </Fragment>)}</tbody>
            <tfoot><tr><th scope='row'>{model.plannedWeeks} weeks</th>{model.totals.map((value, index) => <td key={index}>{value}</td>)}</tr></tfoot>
        </table></div>
        {model.notes.length > 0 && <details><summary>Original timetable notes</summary>{model.notes.map((note, index) => <p key={index}>{note}</p>)}</details>}
    </section>} />
}
