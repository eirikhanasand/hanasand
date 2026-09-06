import { jsPDF } from 'jspdf'
import { autoTable, type RowInput } from 'jspdf-autotable'
import { hoursText, isoWeek, type ActivityLog, type timetable } from './timetableData'

export async function exportTimetablePdf(title: string, model: ReturnType<typeof timetable>, log: ActivityLog) {
    const response = await fetch('/fonts/ThesisSans.ttf')
    if (!response.ok) throw new Error('Report font unavailable')
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    pdf.addFileToVFS('ThesisSans.ttf', btoa(binary))
    pdf.addFont('ThesisSans.ttf', 'ThesisSans', 'normal')
    pdf.setFont('ThesisSans', 'normal')
    pdf.setProperties({ title: 'Thesis timetable and activity report', subject: title, creator: 'Hanasand thesis workspace' })
    const total = log.activities.reduce((sum, item) => sum + Math.round(item.hours * 100), 0) / 100
    pdf.setFontSize(16)
    pdf.text('Thesis timetable', 14, 20)
    pdf.setFontSize(9)
    pdf.text(`${log.startYear}-${model.weeks.at(-1)?.year || log.startYear} | ${hoursText(total)} logged / ${hoursText(model.expectedHours)} expected hours | Exported ${new Date().toISOString().slice(0, 10)}`, 14, 28)
    const styles = { font: 'ThesisSans', fontStyle: 'normal' as const, fontSize: 8, cellPadding: 2, overflow: 'linebreak' as const, lineColor: [220, 225, 230] as [number, number, number], lineWidth: .1 }
    const headStyles = { fillColor: [35, 49, 65] as [number, number, number], textColor: 255, fontStyle: 'normal' as const }
    autoTable(pdf, {
        startY: 34, margin: { top: 15, bottom: 18, left: 14, right: 14 }, styles, headStyles,
        head: [['Week', ...model.categories, 'Total']],
        body: [...model.weeks.map(week => [`${week.year} / ${week.week}${week.legacy ? ' *' : ''}`, ...week.values.map(value => value || '-')]), [`${model.plannedWeeks} weeks`, ...model.totals]],
        columnStyles: { 0: { cellWidth: 23 } }, rowPageBreak: 'avoid',
    })
    pdf.addPage()
    pdf.setFontSize(16)
    pdf.text('Day-by-day activity report', 14, 20)
    pdf.setFontSize(9)
    pdf.text(`${log.activities.length} activities | ${hoursText(total)} logged hours`, 14, 28)
    const body: RowInput[] = []
    const activities = [...log.activities].sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id))
    for (let index = 0; index < activities.length; index++) {
        const activity = activities[index]
        const week = isoWeek(activity.date)
        body.push([activity.date, `${week.year} / ${week.week}`, hoursText(activity.hours), activity.category, activity.description])
        if (activities[index + 1]?.date !== activity.date) {
            const daily = activities.filter(item => item.date === activity.date).reduce((sum, item) => sum + Math.round(item.hours * 100), 0) / 100
            body.push([{ content: `Daily total: ${hoursText(daily)} hours`, colSpan: 5, styles: { fillColor: [239, 242, 245], halign: 'right' } }])
        }
    }
    if (!body.length) body.push([{ content: 'No dated activities have been logged.', colSpan: 5 }])
    autoTable(pdf, { startY: 34, margin: { top: 15, bottom: 18, left: 14, right: 14 }, styles, headStyles,
        head: [['Date', 'Week', 'Hours', 'Category', 'Description']], body, rowPageBreak: 'avoid',
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 23 }, 2: { cellWidth: 14 }, 3: { cellWidth: 30 } },
    })
    const notes = ['Expected hours: 12 per week before Christmas (2.4 per weekday); 37.5 per week from January (7.5 per weekday). Weeks 51-53 and Norwegian public holidays falling on weekdays are excluded. Only planned rows contribute expected hours. Logged work on days off still counts.', ...(model.weeks.some(week => week.legacy) ? ['* Earlier totals are included in the timetable but have no dated activity records. They are excluded from the logged-hours and daily totals.'] : []), ...model.notes]
    if (notes.length) {
        pdf.addPage(); pdf.setFontSize(16); pdf.text('Original timetable notes', 14, 20)
        autoTable(pdf, { startY: 28, margin: { top: 15, bottom: 18, left: 14, right: 14 }, styles, body: notes.map(note => [note]) })
    }
    const count = pdf.getNumberOfPages()
    for (let page = 1; page <= count; page++) {
        pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(90)
        pdf.text(`Thesis activity report | Page ${page} of ${count}`, 14, 288)
    }
    pdf.save(`thesis-timetable-${new Date().toISOString().slice(0, 10)}.pdf`)
}
