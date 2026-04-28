import { Bug } from 'lucide-react'

export default function EmptyState() {
    return (
        <div className='w-full rounded-2xl border border-white/10 bg-black/50 px-6 py-10 text-center'>
            <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-orange-300'>
                <Bug className='h-6 w-6' />
            </div>
            <h2 className='mt-4 font-semibold text-white'>No matches found</h2>
            <p className='mt-2 text-sm text-white/80'>Try another image, CVE, package, or source search.</p>
        </div>
    )
}
