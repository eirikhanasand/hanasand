import { Loader2 } from 'lucide-react'
import { headers } from 'next/headers'

export default async function Loading() {
    // The overview supplies monitoring data in the server response. Avoid a second loading panel.
    if ((await headers()).get('x-current-path') === '/dashboard') return null
    return (
        <main className='site-loading-screen' aria-busy='true' aria-live='polite'>
            <div className='site-loading-panel'>
                <Loader2 className='site-loading-icon' aria-hidden='true' />
                <p className='site-loading-label'>Loading</p>
            </div>
        </main>
    )
}
