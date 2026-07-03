import { SearchX } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'

export default function ErrorState({ error }: { error: string }) {
    return (
        <div className='w-full rounded-2xl border border-[#26354d] bg-[#070d15] px-6 py-10 text-center'>
            <div
                className='mx-auto flex h-14 w-14 items-center justify-center rounded-full border
                    border-rose-400/20 bg-rose-500/10 text-rose-300'
            >
                <SearchX className='h-7 w-7' />
            </div>
            <h2 className='mt-4 font-semibold text-[#e8eef8]'>Failed to load vulnerability report</h2>
            <p className='mt-2 text-sm text-[#c8d3e3]'>
                The page could not read a valid vulnerability payload from the internal API.
            </p>
            <ErrorNotice className='mx-auto mt-5 max-w-2xl text-left' message={error} />
        </div>
    )
}
