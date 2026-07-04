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
        <div className='grid min-h-[calc(100vh-4.5rem)] w-full gap-3 overflow-x-hidden bg-ui-canvas p-3 text-ui-text sm:p-5 md:h-[calc(100vh-4.5rem)] md:grid-cols-[20rem_minmax(0,1fr)] md:p-6 xl:grid-cols-[22rem_minmax(0,1fr)] lg:p-8'>
            <TestPageClient test={test} />
        </div>
    )
}
