export default function formatDescription(input: string) {
    if (!input.includes(' ') || input.length <= 2) {
        return input
    }

    const parts = input.split(' ')
    return `${parts[0]} ${parts[1]}`
}
