import { cookies } from 'next/headers'
import { publicPromptPortalState, readPromptPortalState } from '@/utils/promptPortal/store'
import PromptPortalClient from './promptPortalClient'

export const metadata = {
    title: 'Prompt portal',
}

const COOKIE = 'hanasand_prompt_session'

export default async function PromptPortalPage() {
    const state = await readPromptPortalState()
    const sessionId = (await cookies()).get(COOKIE)?.value
    return <PromptPortalClient initialState={publicPromptPortalState(state, sessionId)} />
}
