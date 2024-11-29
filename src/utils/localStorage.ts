export default function getItem(name: string): object | string | undefined {
    if (typeof window === "undefined" || !window.localStorage) {
        return undefined
    }

    const item = localStorage.getItem(name)

    if (!item) {
        return undefined
    }

    try {
        const parsedOnce = JSON.parse(item)
        try {
            const parsedTwice = JSON.parse(parsedOnce)
            return parsedTwice
        } catch (error) {
            return parsedOnce
        }
    } catch (error: unknown) {
        return item
    }
}

export function setItem(name: string, value: string) {
    if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(name, value);
    }
}

export function removeItem(name: string): void {
    localStorage.removeItem(name)
}