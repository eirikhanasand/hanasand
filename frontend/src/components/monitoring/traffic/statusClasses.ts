export default function statusClasses(status: number) {
    if (status >= 400) {
        return 'bg-ui-danger/10 text-ui-danger'
    }

    if (status >= 300) {
        return 'bg-ui-warning/10 text-ui-warning'
    }

    return 'bg-ui-success/10 text-ui-success'
}
