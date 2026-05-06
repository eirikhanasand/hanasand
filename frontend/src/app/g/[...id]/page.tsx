import { getLink } from '@/utils/links/get'
import { redirect } from 'next/navigation'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const link = await getLink(id)

    if (typeof link === 'number') {
        return redirect(`/g?id=${id}&null=true`)
    }

    if (!link?.path) {
        return redirect(`/g?id=${id}&null=true`)
    }

    return redirect(destinationForRedirect(link.path))
}

function destinationForRedirect(path: string) {
    const trimmed = path.trim()
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        return trimmed
    }
    return `https://${trimmed}`
}
