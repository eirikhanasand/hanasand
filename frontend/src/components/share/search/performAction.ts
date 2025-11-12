import { Dispatch, SetStateAction } from 'react'

type PerformActionProps = {
    action: string
    setSearch: Dispatch<SetStateAction<string>>
    setVisible: Dispatch<SetStateAction<boolean>>
    setTriggerSiteChange: Dispatch<SetStateAction<boolean>>
    setBox: Dispatch<SetStateAction<boolean>>
    setTriggerTerminalChange: Dispatch<SetStateAction<boolean>>
    toggleTheme: () => void
}

export default function performAction({
    action,
    setVisible,
    setSearch,
    setTriggerSiteChange,
    setBox,
    setTriggerTerminalChange,
    toggleTheme
}: PerformActionProps) {
    switch (action) {
        case 'site': return (setTriggerSiteChange(true), setSearch(''), setVisible(false))
        case 'fetch': return (setBox(prev => !prev), setSearch(''), setVisible(false))
        case 'terminal': return (setTriggerTerminalChange(true), setSearch(''), setVisible(false))
        case 'theme': return (toggleTheme(), setSearch(''), setVisible(false))
        default: return (setVisible(false), setSearch(''), setVisible(false))
    }
}
