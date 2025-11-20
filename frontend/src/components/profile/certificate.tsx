'use client'
import useKeyPress from '@/hooks/keyPressed'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteCertificate from '@/utils/certificates/deleteCertificate'
import prettyDate from '@/utils/date/prettyDate'
import { Info, Trash2 } from 'lucide-react'
// import { useRouter } from 'next/navigation'
import Notify from '../notify/notify'
import Tooltip from '../tooltip/tooltip'

export default function Certificate({ certificate, update }: { certificate: Certificate, update: () => void }) {
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const lastSpace = certificate.public_key.lastIndexOf(' ')
    const isManaged = certificate.public_key.endsWith('Hanasand API')
    const endsWith = certificate.public_key.includes(' ')
        ? certificate.public_key.slice(lastSpace)
        : false

    // const router = useRouter()

    async function handleClick() {
        if (!keys['shift']) {
            // router.push(`/profile/${user.id}`)
            // Not sure what to display when clicked? Maybe usage?
        }

        if (keys['shift']) {
            const result = await deleteCertificate(certificate.id)
            if (result.status === 200) {
                update()
            } else {
                setMessage(result.message)
            }
        }
    }

    return (
        <>
            <div onClick={handleClick} className={`rounded-lg ${keys['shift'] ? 'hover:bg-red-500/10 hover:outline hover:outline-red-500/20 select-none' : 'hover:bg-dark'} cursor-pointer p-2 max-w-full overflow-hidden group gap-2 w-full justify-between items-center`}>
                <div className='flex w-full items-center'>
                    <div className='flex-1 overflow-auto'>
                        <div className='flex gap-2'>
                            <div className='flex gap-2 items-center max-h-5 min-w-fit'>
                                <h1 className='text-sm font-semibold text-bright/70'>{certificate.name}</h1>
                            </div>
                            <h1 className='text-almostbright text-sm overflow-auto noscroll max-h-5 whitespace-nowrap'>{certificate.public_key}</h1>
                        </div>
                        <div className='flex gap-1 text-almostbright/70 text-xs justify-between items-center'>
                            <div className='flex gap-1 items-center'>
                                <span>{certificate.id}</span>
                                <span className='font-bold'>·</span>
                                <span>Created</span>
                                <span>{prettyDate(certificate.created_at)}</span>
                                <span>by</span>
                                <span>{certificate.created_by}.</span>
                                <span>Owner:</span>
                                <span>{certificate.owner}.</span>
                            </div>
                            {endsWith && !isManaged && <div className='flex gap-1 items-center'>
                                <span>Ends with</span>
                                <span>{endsWith}</span>
                            </div>}
                            {isManaged && (
                                <Tooltip
                                    align='right'
                                    content={
                                        <h1>
                                            This certificate is automatically managed by the internal integration
                                            Hanasand API. It’s used to spawn webshells, and the certificate
                                            is rotated daily.
                                        </h1>
                                    }
                                >
                                    <div className='p-px'>
                                        <div className="p-1 outline outline-blue-400/40 min-w-full bg-blue-400/20 rounded-md flex gap-1 items-center px-4">
                                            <Info className="h-3 w-3 stroke-blue-400" />
                                            <span className="text-bright/70 text-[0.7rem]">Managed</span>
                                        </div>
                                    </div>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                    {keys['shift'] && <Trash2 className='hidden group-hover:block group-hover:min-w-fit stroke-red-500 w-5 h-5' />}
                </div>
            </div>
            <div className='absolute top-2 right-2 z-1200'>
                <Notify className='px-4' background='bg-dark' message={message} />
            </div>
        </>
    )
}
