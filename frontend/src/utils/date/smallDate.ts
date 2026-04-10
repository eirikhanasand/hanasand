import prettyDate from './prettyDate'

export default function smallDate(input?: string | null) {
    if (!input) {
        return 'Unknown'
    }

    const pretty = prettyDate(input)
    const date = new Date(input)
    const now = new Date()
    if (date.getDate() !== now.getDate()) {
        return pretty
    }

    return pretty.split(' ')[1]
}
