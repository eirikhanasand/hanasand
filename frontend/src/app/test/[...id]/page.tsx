import { fetchTest } from '@/utils/test/fetchTest'
import TestPageClient from './pageClient'
import { redirect } from 'next/navigation'


export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const test = await fetchTest(id)
    if (!test) {
        return redirect(`/test?id=${id}&null=true`)
    }

    return (
        <div className='p-8 flex w-[100vw] h-[90.5vh] gap-2 overflow-hidden'>
            <TestPageClient test={test} />
        </div>
    )
}
