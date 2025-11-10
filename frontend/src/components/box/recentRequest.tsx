import prettyDate from '@/utils/prettyDate'
import requestColor from './requestColor'

export default function RecentRequest({ req }: { req: FetchRequest }) {
    const color = requestColor(req.type)

    return (
        <div className='py-2 overflow-auto space-y-2'>
            <div className='flex items-center gap-2'>
                <div className={`${color} rounded-lg px-2`}>
                    <h1 className='text-sm'>{req.type}</h1>
                </div>
                <h1 className='text-sm text-bright/90'>{req.path}</h1>
            </div>
            <h1 className='text-xs text-almostbright'>{prettyDate(req.created)}</h1>
        </div>
    )
}
