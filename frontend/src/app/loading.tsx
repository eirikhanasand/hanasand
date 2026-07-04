import { Loader2 } from 'lucide-react'

export default function Loading() {
    return (
        <main className='site-loading-screen' aria-busy='true' aria-live='polite'>
            <div className='site-loading-panel'>
                <Loader2 className='site-loading-icon' aria-hidden='true' />
                <p className='site-loading-label'>Loading</p>
            </div>
        </main>
    )
}
