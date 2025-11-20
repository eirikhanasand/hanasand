export default function formatStatus(input: string) {
    if (!input) {
        return ''
    }

    return `${input.slice(0, 1).toUpperCase()}${input.slice(1).toLowerCase()}`
}
