import { jsPDF } from 'jspdf'

export async function exportReportPdf(markdown: string) {
    const response = await fetch('/fonts/ThesisSans.ttf')
    if (!response.ok) throw new Error('Report font unavailable')
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    pdf.addFileToVFS('ReportSans.ttf', btoa(binary))
    pdf.addFont('ReportSans.ttf', 'ReportSans', 'normal')
    pdf.setFont('ReportSans')
    pdf.setProperties({ title: 'Browser report', creator: 'Hanasand' })
    let y = 20
    for (const line of markdown.split('\n')) {
        const heading = /^#{1,6}\s/.test(line)
        pdf.setFontSize(heading ? 14 : 10)
        const text = line.replace(/^#{1,6}\s+/, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
        const height = heading ? 7 : 5
        for (const part of pdf.splitTextToSize(text || ' ', 178)) {
            if (y + height > 278) { pdf.addPage(); y = 20 }
            pdf.text(part, 16, y)
            y += height
        }
    }
    const pages = pdf.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
        pdf.setPage(page)
        pdf.setFontSize(8)
        pdf.text(`Hanasand | ${page} / ${pages}`, 16, 287)
    }
    pdf.save('browser-report.pdf')
}
