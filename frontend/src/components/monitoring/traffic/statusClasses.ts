export default function statusClasses(status: number) {
    if (status >= 400) {
        return 'bg-red-500/20 text-red-400'
    }

    if (status >= 300) {
        return 'bg-yellow-500/20 text-yellow-400'
    }

    return 'bg-green-500/20 text-green-400'
}
