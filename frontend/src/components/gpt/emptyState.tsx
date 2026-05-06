import { Bot } from 'lucide-react'

export default function GPT_EmptyState() {
    return (
        <div className='w-full rounded-xl bg-dark/35 px-6 py-12 text-center outline outline-dark'>
            <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f07d33]/12 text-[#f07d33] outline outline-[#f07d33]/20'>
                <Bot className='h-6 w-6' />
            </div>
            <h2 className='mt-4 font-semibold text-bright/90'>No GPTs connected</h2>
            <p className='mt-2 text-sm text-bright/50'>
                The dashboard will populate automatically when a client joins the room.
            </p>
        </div>
    )
}
