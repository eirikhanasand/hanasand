'use client'
import useKeyPress from '@/hooks/keyPressed'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteCertificate from '@/utils/certificates/deleteCertificate'
import prettyDate from '@/utils/prettyDate'
import { Trash2 } from 'lucide-react'
// import { useRouter } from 'next/navigation'
import Notify from '../notify/notify'

export default function Certificate({ certificate, update }: { certificate: Certificate, update: () => void }) {
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const keys = useKeyPress('Shift')
    // const router = useRouter()

    async function handleClick() {
        if (!keys['Shift']) {
            // router.push(`/profile/${user.id}`)
            // Not sure what to display when clicked? Maybe usage?
        }

        if (keys['Shift']) {
            const result = await deleteCertificate(certificate.id)
            if (result.status === 200) {
                setMessage(`Successfully deleted certificate ${certificate.name}.`)
                update()
            } else {
                setMessage(result.message)
            }
        }
    }

    return (
        <>
            <div onClick={handleClick} className={`rounded-lg ${keys['Shift'] ? 'hover:bg-red-500/10 hover:outline hover:outline-red-500/20' : 'hover:bg-dark'} cursor-pointer p-2 max-w-full overflow-hidden group gap-2 w-full justify-between items-center`}>
                <div className='flex w-full items-center'>
                    <div className='flex-1 overflow-auto'>
                        <div className='flex gap-2'>
                            <div className='flex gap-2 items-center max-h-5 min-w-fit'>
                                <h1 className='text-sm font-semibold text-bright/70'>{certificate.name}</h1>
                            </div>
                            <h1 className='text-almostbright text-sm overflow-auto noscroll'>{certificate.public_key}</h1>
                        </div>
                        <div className='flex gap-1 text-almostbright/70 text-xs'>
                            <span>{certificate.id}</span>
                            <span>·</span>
                            <span>Created</span>
                            <span>{prettyDate(certificate.created_at)}</span>
                            <span>by</span>
                            <span>{certificate.created_by}.</span>
                            <span>Owner:</span>
                            <span>{certificate.owner}.</span>
                        </div>
                    </div>
                    {keys['Shift'] && <Trash2 className='hidden group-hover:block group-hover:min-w-fit stroke-red-500 w-5 h-5' />}
                </div>
            </div>
            <div className='absolute top-2 right-2 z-1200'>
                <Notify className='px-4' background='bg-dark' message={message} />
            </div>
        </>
    )
}
