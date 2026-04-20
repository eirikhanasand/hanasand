import { SearchX } from 'lucide-react'

export default function VulnerabilityErrorState({ error }: { error: string }) {
    return (
        <div className='w-full rounded-2xl border border-login-100/10 bg-login-900/50 px-6 py-10 text-center'>
            <div
                className='mx-auto flex h-14 w-14 items-center justify-center rounded-full border
                    border-rose-400/20 bg-rose-500/10 text-rose-300'
            >
                <SearchX className='h-7 w-7' />
            </div>
            <h2 className='mt-4 font-semibold text-login-50'>Failed to load vulnerability report</h2>
            <p className='mt-2 text-sm text-login-100'>
                The page could not read a valid vulnerability payload from the internal API.
            </p>
            <div
                className='mx-auto mt-5 max-w-2xl rounded-xl border border-rose-400/15
                    bg-rose-500/8 px-4 py-3 text-left text-sm text-rose-200'
            >
                {error}
            </div>
        </div>
    )
}
