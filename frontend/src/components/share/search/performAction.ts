import { Dispatch, SetStateAction } from 'react'

type PerformActionProps = {
    action: string
    setSearch: Dispatch<SetStateAction<string>>
    setVisible: Dispatch<SetStateAction<boolean>>
    setTriggerSiteChange: Dispatch<SetStateAction<boolean>>
}

export default function performAction({ action, setVisible, setSearch, setTriggerSiteChange }: PerformActionProps) {
    switch (action) {
        case 'site': return (setTriggerSiteChange(true), setSearch(''), setVisible(false))
        default: return setVisible(false)
    }
}
