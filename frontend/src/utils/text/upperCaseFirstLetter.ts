export default function upperCaseFirstLetter(text?: string | null) {
    if (!text) {
        return 'Unknown'
    }

    return `${text.slice(0, 1).toUpperCase()}${text.slice(1).toLowerCase()}`
}
