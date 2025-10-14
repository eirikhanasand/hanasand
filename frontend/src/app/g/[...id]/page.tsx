import { getLink } from '@/utils/links/get'
import { redirect } from 'next/navigation'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const link = await getLink(id)

    if (typeof link === 'number') {
        return redirect(`/g?id=${id}&null=true`)
    }    

    if (!link?.path.includes('http')) {
        return redirect(`https://${link?.path}` || `/g?id=${id}&null=true`)
    }

    return redirect(link?.path || `/g?id=${id}&null=true`)
}
