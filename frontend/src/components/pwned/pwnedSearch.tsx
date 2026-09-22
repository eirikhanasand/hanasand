import { CheckCircle2, ShieldAlert } from 'lucide-react'

type PwnedSearchProps = {
    breached: boolean
    breachCount: number | null
    files?: BreachFile[]
}

export default function PwnedSearch({ breached, breachCount, files = [] }: PwnedSearchProps) {
    const count = breachCount || 0

    return (
        <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
            {breached ? (
                <div className='grid gap-3 rounded-lg border border-ui-danger bg-ui-danger/10 p-3 text-sm text-ui-danger'>
                    <div className='flex items-start gap-3'>
                        <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0' />
                        <div className='grid gap-1'>
                            <p className='font-semibold'>Match found</p>
                            <p className='leading-6'>
                                This password has been breached {count.toLocaleString()} {count === 1 ? 'time' : 'times'}.
                            </p>
                        </div>
                    </div>
                    {files.length > 0 ? (
                        <div className='grid gap-2 border-t border-ui-danger/30 pt-3'>
                            <p className='font-semibold'>Found in {files.length.toLocaleString()} {files.length === 1 ? 'file' : 'files'}</p>
                            <ul className='grid gap-2'>
                                {files.map(({ file, count: occurrences, lineRanges }) => (
                                    <li key={file} className='rounded-md bg-ui-panel p-3 text-ui-text'>
                                        <p className='break-all font-mono text-xs'>{file}</p>
                                        <p className='mt-1 text-xs text-ui-muted'>
                                            {occurrences.toLocaleString()} {occurrences === 1 ? 'match' : 'matches'} · {occurrences === 1 ? 'Line' : 'Lines'}{' '}
                                            {lineRanges.map(([first, last]) => first === last ? first.toLocaleString() : `${first.toLocaleString()}–${last.toLocaleString()}`).join(', ')}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className='flex items-start gap-3 rounded-lg border border-ui-success bg-ui-success/10 p-3 text-sm text-ui-success'>
                    <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0' />
                    <div className='grid gap-1'>
                        <p className='font-semibold'>No exact match found</p>
                        <p className='leading-6'>The exact hash was not present in the checked Bloom range. Keep using unique values because this is not a guarantee of secrecy.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
