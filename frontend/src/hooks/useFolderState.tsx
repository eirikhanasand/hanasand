import { createContext, useContext, useEffect, useState } from 'react'
import { getCookie, setCookie } from '@/utils/cookies/cookies'

type OpenFoldersContextType = {
    openFolders: string[]
    toggleFolder: (id: string) => void
    isOpen: (id: string) => boolean
}

const OpenFoldersContext = createContext<OpenFoldersContextType | null>(null)

export default function useFolderState() {
    const ctx = useContext(OpenFoldersContext)
    if (!ctx) {
        throw new Error('useOpenFolders must be used inside OpenFoldersProvider')
    }

    return ctx
}

export function OpenFoldersProvider({ children, serverOpenFolders }: { children: React.ReactNode, serverOpenFolders: string[] }) {
    const [openFolders, setOpenFolders] = useState<string[]>(serverOpenFolders)

    useEffect(() => {
        const saved = getCookie('openFolders')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed)) {
                    setOpenFolders(parsed)
                }
            } catch {
                console.warn('Invalid openFolders cookie')
            }
        }
    }, [])

    useEffect(() => {
        setCookie('openFolders', JSON.stringify(openFolders))
    }, [openFolders])

    function toggleFolder(id: string) {
        setOpenFolders(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        )
    }

    function isOpen(id: string) {
        return openFolders.includes(id)
    }

    return (
        <OpenFoldersContext.Provider value={{ openFolders, toggleFolder, isOpen }}>
            {children}
        </OpenFoldersContext.Provider>
    )
}
