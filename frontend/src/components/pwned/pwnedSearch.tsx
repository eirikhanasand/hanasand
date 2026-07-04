import { CheckCircle2, ShieldAlert } from 'lucide-react'

type PwnedSearchProps = {
    breached: boolean
    breachCount: number | null
    checkedPrefix?: string
}

export default function PwnedSearch({ breached, breachCount, checkedPrefix }: PwnedSearchProps) {
    const count = breachCount || 0

    return (
        <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
            {breached ? (
                <div className='grid gap-3 rounded-lg border border-ui-danger bg-ui-danger/10 p-3 text-sm text-ui-danger'>
                    <div className='flex items-start gap-3'>
                        <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0' />
                        <div className='grid gap-1'>
                            <p className='font-semibold'>Exact match found</p>
                            <p className='leading-6'>
                                This hash appears {count.toLocaleString()} {count === 1 ? 'time' : 'times'} in known breach data. Treat the underlying secret as exposed.
                            </p>
                        </div>
                    </div>
                    <div className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs leading-5 text-ui-text'>
                        Next action: rotate the underlying secret anywhere it was used and replace it with a unique value from your secret manager.
                    </div>
                </div>
            ) : (
                <div className='flex items-start gap-3 rounded-lg border border-ui-success bg-ui-success/10 p-3 text-sm text-ui-success'>
                    <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0' />
                    <div className='grid gap-1'>
                        <p className='font-semibold'>No exact match found</p>
                        <p className='leading-6'>This only means the exact hash was not present in the checked breach range. Use unique secrets anyway.</p>
                    </div>
                </div>
            )}
            <p className='text-xs leading-5 text-ui-muted'>
                Privacy check: checkedPrefix {checkedPrefix || '-----'} was sent to the range API without sending the full hash or underlying secret to Hanasand.
            </p>
        </div>
    )
}
