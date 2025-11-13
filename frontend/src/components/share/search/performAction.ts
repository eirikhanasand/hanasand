import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { Dispatch, SetStateAction } from 'react'

type PerformActionProps = {
    action: string
    setSearch: Dispatch<SetStateAction<string>>
    setVisible: Dispatch<SetStateAction<boolean>>
    setTriggerSiteChange: Dispatch<SetStateAction<boolean | 'close'>>
    setBox: Dispatch<SetStateAction<boolean>>
    setTriggerTerminalChange: Dispatch<SetStateAction<boolean | 'close'>>
    toggleTheme: () => void
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    setShowMetaData: Dispatch<SetStateAction<boolean>>
    setSelectedResult: Dispatch<SetStateAction<number>>
    router: AppRouterInstance
}

export default function performAction({
    action,
    setVisible,
    setSearch,
    setTriggerSiteChange,
    setBox,
    setTriggerTerminalChange,
    toggleTheme,
    setShowExplorer,
    setShowMetaData,
    setSelectedResult,
    router
}: PerformActionProps) {
    function reset() {
        setSearch('')
        setVisible(false)
        setSelectedResult(0)
    }

    function hide() {
        setTriggerSiteChange('close')
        setBox(false)
        setTriggerTerminalChange('close')
    }

    switch (action) {
        case 'site': setTriggerSiteChange(true); break
        case 'fetch': setBox(prev => !prev); break
        case 'terminal': setTriggerTerminalChange(true); break
        case 'theme': toggleTheme(); break
        case 'hide': hide(); break
        case 'info': setShowMetaData(prev => !prev); break
        case 'explorer': setShowExplorer(prev => !prev); break
        case 'reload':
            router.refresh()
            reset()
            break;
    }

    reset()
}
