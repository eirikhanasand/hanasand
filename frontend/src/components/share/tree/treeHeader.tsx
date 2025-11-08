// import { postShare } from '@/utils/share/post'
import { FilePlus, FolderPlus } from 'lucide-react'

export default function TreeHeader({ share }: { share: Share }) {
    const buttonStyle = 'rounded-sm h-6 w-6 hover:bg-extralight/80 grid place-items-center cursor-pointer'
    
    function handleClick(type: string) {
        // postShare({path, content, name, parent, type})
    }

    return (
        <div className='bg-light rounded-md w-full p-1 px-2 flex gap-2 items-center justify-between'>
            <h1 className='text-sm text-gray-400'>{share.alias}</h1>
            <div className='flex gap-2'>
                <div onClick={() => handleClick('folder')} className={buttonStyle}>
                    <FilePlus className='stroke-gray-400 w-4 h-4' />
                </div>
                <div onClick={() => handleClick('file')} className={buttonStyle}>
                    <FolderPlus className='stroke-gray-400 w-4 h-4' />
                </div>
            </div>
        </div>
    )
}
