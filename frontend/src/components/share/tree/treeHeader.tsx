import { FilePlus, FolderPlus } from 'lucide-react'

export default function TreeHeader({ share }: { share: Share }) {
    return (
        <div className='bg-light rounded-lg w-full p-1 px-2 flex gap-2 items-center justify-between'>
            <h1 className='text-sm text-gray-400'>{share.alias}</h1>
            <div className='flex gap-2'>
                <FilePlus className='stroke-gray-400 w-4 h-4' />
                <FolderPlus className='stroke-gray-400 w-4 h-4' />
            </div>
        </div>
    )
}
