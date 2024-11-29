import { MutableRefObject } from "react"
import { updateUserTime } from "./fetch"

type FocusCheckProps = {
    startFocusTime: MutableRefObject<Date | undefined>
    lastUserInteraction: MutableRefObject<Date | undefined>
}

type WindowFocusedProps = {
    lastUserInteraction: MutableRefObject<Date | undefined>
    startFocusTime: MutableRefObject<Date | undefined>
}

// Check if the user has been inactive for more than 4.5 minutes
export function focusCheck({startFocusTime, lastUserInteraction}: FocusCheckProps) {
    if (startFocusTime.current != undefined) {
        let currentTime = new Date()
        if ((currentTime.getTime() - (lastUserInteraction.current?.getTime() || 0)) > (270 * 1000)) {
            windowUnfocused(startFocusTime)
        }
    }
}

// Handler for window focus event to update the last user interaction time
export function windowFocused({lastUserInteraction, startFocusTime}: WindowFocusedProps) {
    lastUserInteraction.current = new Date()
    if (startFocusTime.current == undefined) {
        startFocusTime.current = new Date()
    }
}

// Handler for window unfocus event to update time spent on the page
export function windowUnfocused(startFocusTime: MutableRefObject<Date | undefined>) {
    if (startFocusTime.current != undefined) {
        let stopFocusTime = new Date()
        let time = stopFocusTime.getTime() - startFocusTime.current.getTime()
        startFocusTime.current = undefined
        updateUserTime({time})
    }
}
