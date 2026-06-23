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
            <div onClick={handleClick} className={`group w-full cursor-pointer overflow-hidden rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 transition ${keys['shift'] ? 'select-none hover:border-red-200 hover:bg-red-50' : 'hover:border-[#cfd7e3] hover:bg-white'}`}>
                <div className='flex w-full items-center'>
                    <div className='min-w-0 flex-1'>
                        <div className='flex min-w-0 items-center gap-2'>
                            <div className='flex min-w-fit items-center gap-2'>
                                <h1 className='text-sm font-semibold text-[#171a21]'>{certificate.name}</h1>
                            </div>
                            <p className='truncate text-sm text-[#687386]'>{certificate.public_key}</p>
                        </div>
                        <div className='mt-1 flex gap-2 text-xs text-[#687386]'>
                            <div className='flex min-w-0 flex-wrap gap-1'>
                                <span>{certificate.id}</span>
                                <span className='font-bold'>·</span>
                                <span>{prettyDate(certificate.created_at)}</span>
                                <span>·</span>
                                <span>{certificate.owner}</span>
                            </div>
                            {endsWith && !isManaged && <div className='ml-auto hidden shrink-0 gap-1 sm:flex'>
                                <span>Ends with</span>
                                <span>{endsWith}</span>
                            </div>}
                            {isManaged && (
                                <Tooltip
                                    align='right'
                                    content={
                                        <h1>Managed by Hanasand API and rotated automatically.</h1>
                                    }
                                >
                                    <div className='p-px'>
                                        <div className='flex min-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1'>
                                            <Info className='h-3 w-3 stroke-blue-600' />
                                            <span className='text-[0.7rem] text-blue-700'>Managed</span>
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
                <Notify className='px-4' background='bg-white' message={message} />
            </div>
        </>
    )
}
