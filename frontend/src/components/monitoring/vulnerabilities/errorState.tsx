import { SearchX } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'

export default function ErrorState({ error }: { error: string }) {
    return (
        <div className='w-full rounded-lg border border-ui-border bg-ui-panel px-6 py-10 text-center'>
            <div
                className='mx-auto flex h-14 w-14 items-center justify-center rounded-full border
                    border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
            >
                <SearchX className='h-7 w-7' />
            </div>
            <h2 className='mt-4 font-semibold text-ui-text'>Failed to load vulnerability report</h2>
            <p className='mt-2 text-sm text-ui-muted'>
                The page could not read a valid vulnerability payload from the internal API.
            </p>
            <ErrorNotice className='mx-auto mt-5 max-w-2xl text-left' message={error} />
        </div>
    )
}
