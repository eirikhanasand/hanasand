import HideIfLittleSpace from '@/hooks/hideIfLittleSpace'
import useMovable from '@/hooks/movable'
import { Folder, X } from 'lucide-react'
import { Dispatch, SetStateAction } from 'react'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

export default function Explorer({ showExplorer, setShowExplorer }: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    HideIfLittleSpace({set: setShowExplorer})

    if (!showExplorer) {
        return (
            <div
                onMouseDown={handleMouseDown}
                onClick={handleOpen}
                className={`group ${sharedStyles}`}
                style={{
                    top: position.y,
                    left: position.x,
                }}
            >
                <h1><Folder className='stroke-light/50 group-hover:stroke-bright' /></h1>
            </div>
        )
    }

    return (
        <div className='bg-normal min-w-fit w-[15vw] h-full p-2'>
            <div className='bg-light rounded-lg hover:bg-dark/50 h-12 w-12 grid place-items-center cursor-pointer'>
                <X className='cursor-pointer' onClick={() => setShowExplorer(false)} />
            </div>
        </div>
    )
}
