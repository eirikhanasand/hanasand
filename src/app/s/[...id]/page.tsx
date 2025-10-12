import SharePageClient from './clientPage'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    return <SharePageClient id={id} />
}
