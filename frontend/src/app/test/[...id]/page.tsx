import { fetchTest } from '@/utils/test/fetchTest'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const test = await fetchTest(id)

    return (
        <div>
            <h1>{JSON.stringify(test)}</h1>
        </div>
    )
}
