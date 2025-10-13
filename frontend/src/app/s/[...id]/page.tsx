import SharePageClient from './clientPage'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    return (
        <div className='w-full h-[93.5vh]'>
            <SharePageClient id={id} />
        </div>
    )
}
