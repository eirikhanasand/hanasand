export type ThesisNavigationSheet = { label: string, href: string }

let sheets: ThesisNavigationSheet[] = []
const listeners = new Set<() => void>()

export function getThesisNavigation() {
    return sheets
}

export function subscribeThesisNavigation(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function setThesisNavigation(next: ThesisNavigationSheet[]) {
    if (sheets.length === next.length && sheets.every((sheet, index) => sheet.label === next[index].label && sheet.href === next[index].href)) return
    sheets = next
    listeners.forEach(listener => listener())
}
