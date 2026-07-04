import { Bot } from 'lucide-react'

export default function GPT_EmptyState() {
    return (
        <div className='w-full rounded-xl bg-ui-canvas/35 px-6 py-12 text-center outline outline-ui-border'>
            <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ui-primary/12 text-ui-primary outline outline-ui-primary/20'>
                <Bot className='h-6 w-6' />
            </div>
            <h2 className='mt-4 font-semibold text-ui-text/90'>No GPTs connected</h2>
            <p className='mt-2 text-sm text-ui-text/50'>
                The dashboard updates automatically when a client joins the room.
            </p>
        </div>
    )
}
