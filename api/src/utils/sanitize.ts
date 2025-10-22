export default function sanitize(input: string) {
    return input.replace(/[^a-zA-Z0-9_-]/g, '').trim()
}
