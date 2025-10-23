import prettyDate from '@/utils/prettyDate'
import { fetchTest } from '@/utils/test/fetchTest'
import upperCaseFirstLetter from '@/utils/text/upperCaseFirstLetter'
import { ActivityIcon, Fingerprint, LinkIcon, Timer, Watch, Workflow } from 'lucide-react'
import { redirect } from 'next/navigation'
import Visits from './visits'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const test = await fetchTest(id)
    if (!test) {
        return redirect(`/test?id=${id}&null=true`)
    }

    return (
        <div className='p-8 grid grid-cols-4 w-full h-full gap-2'>
            <LeftSide test={test} />
            <Content test={test} />
        </div>
    )
}

function Content({ test }: { test: Test }) {
    return (
        <div className='p-2 outline-1 outline-dark rounded-lg w-full h-full'>
            <h1 className='text-lg font-semibold'>Test Results</h1>
            <h1 className='break-all'>{JSON.stringify(test)}</h1>
        </div>
    )
}

function LeftSide({ test }: { test: Test }) {
    return (
        <div className='p-2 outline-1 outline-dark rounded-lg h-full grid gap-2'>
            <h1 className='text-lg font-semibold'>Metadata</h1>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Fingerprint />
                <h1>{test.id}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <LinkIcon />
                <h1>{test.url}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Timer />
                <h1>{test.timeout}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Workflow />
                <h1>{test.stages.default ? 'Default' : JSON.stringify(test.stages)}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <ActivityIcon />
                <h1>{upperCaseFirstLetter(test.status)}</h1>
            </div>
            <Visits id={test.id} serverVisits={test.visits} />
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Watch />
                <h1>{prettyDate(test.created_at)}</h1>
            </div>
        </div>
    )
}
