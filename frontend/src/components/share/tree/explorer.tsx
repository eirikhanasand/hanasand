import useHideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import { OpenFoldersProvider } from '@/hooks/useFolderState'
import { Folder, X } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'
import TreeHeader from './treeHeader'
import Tree from './tree'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    openFolders: string[]
    tree: Tree | null
    share: Share | null
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

export default function Explorer({ showExplorer, setShowExplorer, openFolders, tree: serverTree, share }: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    const [tree, setTree] = useState(serverTree)
    useHideIfLittleSpace({ set: setShowExplorer })

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

    console.log("this", tree, share)

    return (
        <div className='bg-normal min-w-fit w-[15vw] h-full p-2 space-y-2'>
            <div className='bg-light rounded-lg hover:bg-dark/50 h-12 w-12 grid place-items-center cursor-pointer'>
                <X className='cursor-pointer' onClick={() => setShowExplorer(false)} />
            </div>
            {(!tree || !share) && <div className='bg-red-500/50 w-full rounded-lg p-2'>
                <h1 className='text-sm'>Unable to load file tree.</h1>
            </div>}
            {tree && share && <OpenFoldersProvider serverOpenFolders={openFolders}>
                <TreeHeader share={share} />
                <Tree tree={tree} />
            </OpenFoldersProvider>}
        </div>
    )
}
