import { useState, useEffect } from "react"

type KeyOrRange = string | { from: string, to: string }

export default function useKeyPress(keys: KeyOrRange | KeyOrRange[]) {
    const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({})

    useEffect(() => {
        const keyList: KeyOrRange[] = Array.isArray(keys) ? keys : [keys]

        function handleKeyDown(event: KeyboardEvent) {
            setPressedKeys((prev) => {
                const newState = { ...prev }
                keyList.forEach((key) => {
                    if (typeof key === "string" && event.key === key) {
                        newState[key] = true
                    } else if (
                        typeof key === "object" &&
                        key.from <= event.key &&
                        event.key <= key.to
                    ) {
                        for (let k = key.from.charCodeAt(0); k <= key.to.charCodeAt(0); k++) {
                            newState[String.fromCharCode(k)] = true
                        }
                    }
                })
                return newState
            })
        }

        function handleKeyUp(event: KeyboardEvent) {
            setPressedKeys((prev) => {
                const newState = { ...prev }
                keyList.forEach((key) => {
                    if (typeof key === "string" && event.key === key) {
                        newState[key] = false
                    } else if (
                        typeof key === "object" &&
                        key.from <= event.key &&
                        event.key <= key.to
                    ) {
                        for (let k = key.from.charCodeAt(0); k <= key.to.charCodeAt(0); k++) {
                            newState[String.fromCharCode(k)] = false
                        }
                    }
                })
                return newState
            })
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
        }
    }, [keys])

    return pressedKeys
}
