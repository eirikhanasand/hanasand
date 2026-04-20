import { Bug } from 'lucide-react'

export default function VulnerabilityEmptyState() {
    return (
        <div className='w-full rounded-2xl border border-login-100/10 bg-login-900/50 px-6 py-10 text-center'>
            <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-login-50/5 text-login'>
                <Bug className='h-6 w-6' />
            </div>
            <h2 className='mt-4 font-semibold text-login-50'>No matches found</h2>
            <p className='mt-2 text-sm text-login-100'>Try another image, CVE, package, or source search.</p>
        </div>
    )
}
