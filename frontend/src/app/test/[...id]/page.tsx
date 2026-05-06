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
        <div className='grid min-h-[90.5vh] w-full gap-3 overflow-x-hidden p-3 sm:p-5 md:h-[90.5vh] md:grid-cols-[18rem_minmax(0,1fr)] md:p-6 lg:p-8'>
            <TestPageClient test={test} />
        </div>
    )
}
