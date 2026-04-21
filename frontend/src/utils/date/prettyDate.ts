export default function prettyDate(date: string) {
    if (!date) {
        return 'Unknown'
    }
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) {
        return 'Unknown'
    }
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    const hour = d.getHours().toString().padStart(2, '0')
    const minute = d.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}.${year}, ${hour}:${minute}`
}
