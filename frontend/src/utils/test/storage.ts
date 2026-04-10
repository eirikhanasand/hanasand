export const CODEX_LOAD_TEST_STORAGE_KEY = 'hanasand.test.codex-load-test.v1'

export type CodexLoadTestDraft = {
    createdAt: string
    source: 'load-test'
    url: string
    timeout?: number
    notes: string
    stages?: object
}

export function saveCodexLoadTestDraft(draft: CodexLoadTestDraft) {
    if (typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(CODEX_LOAD_TEST_STORAGE_KEY, JSON.stringify(draft))
}
