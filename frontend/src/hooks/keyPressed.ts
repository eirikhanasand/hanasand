import { useEffect, useState } from "react"

type KeyOrRange = string | { from: string, to: string }

export default function useKeyPress(keys: KeyOrRange | KeyOrRange[]) {
    const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({})

    useEffect(() => {
        const keyList = Array.isArray(keys) ? keys : [keys]
        const normalizedKeys = keyList.map(k =>
            typeof k === "string"
                ? normalizeKey(k)
                : { from: normalizeKey(k.from), to: normalizeKey(k.to) }
        )

        function downHandler(event: KeyboardEvent) {
            const key = normalizeKey(event.key)
            setPressedKeys(prev => {
                const next = { ...prev }

                normalizedKeys.forEach(item => {
                    if (typeof item === "string" && item === key) {
                        next[item] = true
                    } else if (typeof item === "object") {
                        const from = item.from.charCodeAt(0)
                        const to = item.to.charCodeAt(0)
                        const code = key.charCodeAt(0)
                        if (code >= from && code <= to) {
                            for (let c = from; c <= to; c++) {
                                next[String.fromCharCode(c)] = true
                            }
                        }
                    }
                })

                next["meta"] = event.metaKey
                next["control"] = event.ctrlKey
                next["alt"] = event.altKey
                next["shift"] = event.shiftKey
                return next
            })
        }

        function upHandler(event: KeyboardEvent) {
            const key = normalizeKey(event.key)
            setPressedKeys(prev => {
                let next = { ...prev }

                normalizedKeys.forEach(item => {
                    if (typeof item === "string" && item === key) {
                        next[item] = false
                    } else if (typeof item === "object") {
                        const from = item.from.charCodeAt(0)
                        const to = item.to.charCodeAt(0)
                        const code = key.charCodeAt(0)
                        if (code >= from && code <= to) {
                            for (let c = from; c <= to; c++) {
                                next[String.fromCharCode(c)] = false
                            }
                        }
                    }
                })

                next["meta"] = event.metaKey
                next["control"] = event.ctrlKey
                next["alt"] = event.altKey
                next["shift"] = event.shiftKey

                if (!event.metaKey) {
                    next = { meta: false, control: event.ctrlKey, alt: event.altKey, shift: event.shiftKey }
                }

                return next
            })
        }

        function reset() {
            setPressedKeys({})
        }

        window.addEventListener("keydown", downHandler)
        window.addEventListener("keyup", upHandler)
        window.addEventListener("blur", reset)

        return () => {
            window.removeEventListener("keydown", downHandler)
            window.removeEventListener("keyup", upHandler)
            window.removeEventListener("blur", reset)
        }
    }, [keys])

    return pressedKeys
}

function normalizeKey(key: string): string {
    const lower = key.toLowerCase()
    switch (lower) {
        case "cmd":
        case "command":
        case "meta": return "meta"
        case "ctrl":
        case "control": return "control"
        case "alt":
        case "option": return "alt"
        case "shift": return "shift"
        case "esc":
        case "escape": return "escape"
        case "space":
        case " ": return " "
        case "enter":
        case "return": return "enter"
        default: return lower
    }
}
