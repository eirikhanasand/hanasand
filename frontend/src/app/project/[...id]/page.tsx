import { redirect } from 'next/navigation'

export default async function Page(props: {
    params: Promise<{ id: string[] }>
}) {
    const params = await props.params
    redirect(`/p/${params.id.join('/')}`)
}
