import { notFound, redirect } from 'next/navigation'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    if (params.id[0] === 'cron') notFound()
    const id = params.id.map(segment => encodeURIComponent(segment)).join('/')
    redirect(`/dashboard/vms/${id}`)
}
